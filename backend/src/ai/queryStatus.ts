import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { withAuth } from "../shared/withAuth";

const dbClient = new DynamoDBClient({});
const db = DynamoDBDocumentClient.from(dbClient);

const TABLE_NAME = process.env.TABLE_NAME;

const queryStatusHandler: APIGatewayProxyHandlerV2 = async (event, mobileNumber) => {
  if (!TABLE_NAME) {
    return { statusCode: 500, body: JSON.stringify({ error: "Missing configuration" }) };
  }

  try {
    const jobId = event.queryStringParameters?.jobId;
    if (!jobId) {
      return { statusCode: 400, body: JSON.stringify({ error: "jobId is required" }) };
    }

    const result = await db.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `JOB#${jobId}`,
        SK: "METADATA"
      }
    }));

    const job = result.Item;
    if (!job) {
      return { statusCode: 404, body: JSON.stringify({ error: "Job not found" }) };
    }

    // Ensure the job belongs to the authenticated user
    if (job.mobileNumber !== mobileNumber) {
      return { statusCode: 403, body: JSON.stringify({ error: "Unauthorized access to job" }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        jobId: job.PK.replace("JOB#", ""),
        status: job.status,
        result: job.result,
        error: job.error
      }),
    };

  } catch (error: any) {
    console.error("AI Query Status Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  }
};

export const handler = withAuth(queryStatusHandler);
