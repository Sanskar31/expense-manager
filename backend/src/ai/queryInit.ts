
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { withAuth } from "../shared/withAuth";
import { randomUUID } from "crypto";

const dbClient = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(dbClient);
const sqs = new SQSClient({});

const TABLE_NAME = process.env.TABLE_NAME;
const QUEUE_URL = process.env.QUEUE_URL;

const queryInitHandler = async (event: any, mobileNumber: string) => {
  console.log("AI Query Init triggered for user:", mobileNumber);
  
  if (!TABLE_NAME || !QUEUE_URL) {
    return { statusCode: 500, body: JSON.stringify({ error: "Missing configuration" }) };
  }

  try {
    const { query } = JSON.parse(event.body || "{}");
    if (!query) {
      return { statusCode: 400, body: JSON.stringify({ error: "Query is required" }) };
    }

    const jobId = randomUUID();
    const ttl = Math.floor(Date.now() / 1000) + 3600; // Expire in 1 hour

    // 1. Write PENDING job state to DynamoDB
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `JOB#${jobId}`,
        SK: "METADATA",
        mobileNumber,
        status: "PENDING",
        query,
        ttl
      }
    }));

    // 2. Queue the job in SQS for the worker Lambda to pick up
    await sqs.send(new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify({ jobId, mobileNumber, query }),
    }));

    console.log(`Job ${jobId} initialized successfully`);

    // 3. Instantly return the Job ID so frontend can start polling
    return {
      statusCode: 202, // Accepted
      body: JSON.stringify({ jobId, status: "PENDING" }),
    };

  } catch (error: any) {
    console.error("AI Query Init Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};

export const handler = withAuth(queryInitHandler);
