import { SQSEvent } from "aws-lambda";
import { QueryCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE_NAME } from "../shared/db";
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

export const handler = async (event: SQSEvent) => {
  if (!process.env.GEMINI_API_KEY) {
    console.error("Gemini API key is not configured");
    throw new Error("Gemini API key is not configured");
  }

  for (const record of event.Records) {
    const { jobId, mobileNumber, query, modelPreference = "gemini-3.6-flash" } = JSON.parse(record.body);

    console.log(`Processing AI Query for Job ${jobId} (User: ${mobileNumber}): ${query}`);

    try {
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

      let response = await chat.sendMessage({ message: query });

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
      
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(finalContent);
      } catch (e) {
        console.error("Failed to parse Gemini JSON output:", finalContent);
        // Fallback
        parsedResponse = { text: finalContent.replace(/[{}]/g, "") };
      }

      // 4. Write success status to DB
      await db.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `JOB#${jobId}`, SK: "METADATA" },
        UpdateExpression: "SET #status = :s, #result = :r",
        ExpressionAttributeNames: { "#status": "status", "#result": "result" },
        ExpressionAttributeValues: { ":s": "COMPLETED", ":r": parsedResponse }
      }));
      console.log(`Job ${jobId} completed successfully`);

    } catch (err: any) {
      console.error(`AI Query Worker Error for Job ${jobId}:`, err);
      
      let errorMsg = "Failed to process AI query";
      if (err?.status === 429 || err?.message?.toLowerCase().includes('429') || err?.message?.toLowerCase().includes('quota')) {
        errorMsg = "Rate limit exceeded for this model.";
      }

      // 5. Write error status to DB
      await db.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `JOB#${jobId}`, SK: "METADATA" },
        UpdateExpression: "SET #status = :s, #error = :e",
        ExpressionAttributeNames: { "#status": "status", "#error": "error" },
        ExpressionAttributeValues: { ":s": "FAILED", ":e": errorMsg }
      }));
    }
  }
};
