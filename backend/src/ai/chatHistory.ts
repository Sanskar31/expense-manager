
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { withAuth } from "../shared/withAuth";

const dbClient = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(dbClient);

const TABLE_NAME = process.env.TABLE_NAME;

const chatHistoryHandler = async (event: any, mobileNumber: string) => {
  if (!TABLE_NAME) {
    return { statusCode: 500, body: JSON.stringify({ error: "Missing configuration" }) };
  }

  const method = event.requestContext.http.method;

  try {
    if (method === "GET") {
      const result = await db.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${mobileNumber}`,
          SK: "AI_HISTORY"
        }
      }));

      return {
        statusCode: 200,
        body: JSON.stringify({ messages: result.Item?.messages || [] })
      };
    }

    if (method === "POST") {
      const { messages } = JSON.parse(event.body || "{}");
      if (!Array.isArray(messages)) {
        return { statusCode: 400, body: JSON.stringify({ error: "messages array is required" }) };
      }

      await db.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `USER#${mobileNumber}`,
          SK: "AI_HISTORY",
          messages
        }
      }));

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    if (method === "DELETE") {
      await db.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `USER#${mobileNumber}`,
          SK: "AI_HISTORY"
        }
      }));

      return { statusCode: 200, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (error: any) {
    console.error("AI Chat History Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};

export const handler = withAuth(chatHistoryHandler);
