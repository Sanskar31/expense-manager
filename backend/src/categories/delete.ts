import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE_NAME } from "../shared/db";
import { verifyToken } from "../auth/verifyToken";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log("Archive Category Event. SK:", event.queryStringParameters?.SK);
  try {
    const mobileNumber = verifyToken(event.cookies);
    if (!mobileNumber) {
      console.error("Unauthorized request");
      return { statusCode: 401, body: JSON.stringify({ message: "Unauthorized" }) };
    }

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
  } catch (error) {
    console.error("Error archiving category:", error);
    return { statusCode: 500, body: JSON.stringify({ message: "Internal server error" }) };
  }
};
