import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE_NAME } from "../shared/db";
import { withAuth } from "../shared/withAuth";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async (event, mobileNumber) => {
  console.log("Get Categories Event");

  console.log(`Fetching categories for user ${mobileNumber}`);
  const result = await db.send(new QueryCommand({
    TableName: TABLE_NAME,
    KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
    ExpressionAttributeValues: {
      ":pk": `USER#${mobileNumber}`,
      ":skPrefix": "CAT#"
    }
  }));

  console.log(`Found ${result.Items?.length || 0} categories`);
  return {
    statusCode: 200,
    body: JSON.stringify(result.Items || [])
  };
});
