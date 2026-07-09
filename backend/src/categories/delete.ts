import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE_NAME } from "../shared/db";
import { withAuth } from "../shared/withAuth";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async (event, mobileNumber) => {
  console.log("Archive Category Event. SK:", event.queryStringParameters?.SK);
  
  const SK = event.queryStringParameters?.SK;
  if (!SK) {
    console.error("Missing SK in delete category request");
    return { statusCode: 400, body: JSON.stringify({ message: "Category SK required" }) };
  }

  console.log(`Archiving category SK: ${SK}`);
  await db.send(new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { PK: `USER#${mobileNumber}`, SK },
    UpdateExpression: "SET isArchived = :true",
    ExpressionAttributeValues: {
      ":true": true
    }
  }));

  console.log("Category archived successfully");
  return { statusCode: 200, body: JSON.stringify({ message: "Category archived" }) };
});
