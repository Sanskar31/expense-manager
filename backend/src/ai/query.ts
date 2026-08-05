import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE_NAME } from "../shared/db";
import { withAuth } from "../shared/withAuth";
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const SYSTEM_INSTRUCTION = `
You are PocketLog AI, a helpful and expert financial assistant.
You help users analyze their expenses and income.
You have access to a tool 'fetch_transactions' to retrieve the user's data.
Always fetch data before answering if the query requires looking at their actual spending.
When answering, be conversational, friendly, and highlight key insights using markdown.
If the user's query can be visualized (like a breakdown by category, or a daily trend), you MUST include chartData in your final response format.

IMPORTANT: Your final response MUST be a valid JSON object matching this schema:
{
  "text": "Your conversational markdown response here.",
  "chartData": [ { "name": "Label", "value": 123 }, ... ] // Optional, omit if not applicable
}
Do NOT wrap the JSON in backticks (e.g. \`\`\`json). Just output raw JSON.
`;

export const handler: APIGatewayProxyHandlerV2 = withAuth(async (event, mobileNumber) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: "Gemini API key is not configured" }) };
    }

    const body = JSON.parse(event.body || "{}");
    const userMessage = body.message;
    const modelPreference = body.model || "gemini-1.5-flash";

    if (!userMessage) {
      return { statusCode: 400, body: JSON.stringify({ error: "Message is required" }) };
    }

    console.log(`AI Query from ${mobileNumber}: ${userMessage}`);

    // Step 1: Send the user message to Gemini with the tool declaration
    let chat = ai.chats.create({
      model: modelPreference,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{
          functionDeclarations: [{
            name: "fetch_transactions",
            description: "Fetches the user's financial transactions. Use this to get data before answering.",
            parameters: {
              type: Type.OBJECT,
              properties: {
                month: { 
                  type: Type.STRING, 
                  description: "Optional. The month to fetch in YYYY-MM format. If you need all history, pass 'ALL'." 
                }
              }
            }
          }]
        }],
        temperature: 0.2
      }
    });

    let response = await chat.sendMessage({ message: userMessage });

    // Step 2: Check if Gemini wants to call a tool
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      
      if (call.name === "fetch_transactions") {
        const monthArgs = (call.args as any)?.month;
        let skPrefix = "TX#";
        if (monthArgs && monthArgs !== "ALL") {
          skPrefix = `TX#${monthArgs}#`;
        }

        console.log(`Executing tool fetch_transactions with SK prefix: ${skPrefix}`);
        
        // Fetch data from DynamoDB
        const result = await db.send(new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": `USER#${mobileNumber}`,
            ":skPrefix": skPrefix
          }
        }));

        const transactions = result.Items || [];
        
        // Simplify transactions to save tokens
        const miniTxs = transactions.map(t => ({
          d: t.timestamp.substring(0, 10), // just date
          a: t.amount,
          t: t.type,
          c: t.categoryId,
          desc: t.description
        }));

        console.log(`Fetched ${miniTxs.length} transactions for AI.`);

        // Step 3: Send the tool result back to Gemini
        // We use stringified JSON inside a generic "message" because the official 
        // @google/genai Node SDK has specific typings for function responses.
        response = await chat.sendMessage({
           message: [{
             functionResponse: {
               name: "fetch_transactions",
               response: { transactions: miniTxs }
             }
           }]
        });
      }
    }

    // Parse final JSON response
    let finalContent = response.text || "{}";
    
    // Sometimes the model might wrap in markdown anyway, try to clean it
    if (finalContent.startsWith("\`\`\`json")) {
      finalContent = finalContent.replace(/\`\`\`json\n?/, "").replace(/\`\`\`$/, "");
    }
    
    try {
      const parsed = JSON.parse(finalContent);
      return {
        statusCode: 200,
        body: JSON.stringify(parsed)
      };
    } catch (e) {
      console.error("Failed to parse Gemini JSON output:", finalContent);
      // Fallback
      return {
        statusCode: 200,
        body: JSON.stringify({ text: finalContent.replace(/[{}]/g, "") })
      };
    }

  } catch (err: any) {
    console.error("AI Query Error:", err);
    
    // Check if it's a rate limit error from Gemini
    if (err?.status === 429 || err?.message?.toLowerCase().includes('429') || err?.message?.toLowerCase().includes('quota')) {
      return {
        statusCode: 429,
        body: JSON.stringify({ error: "Rate limit exceeded for this model." })
      };
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || "Failed to process AI query" })
    };
  }
});
