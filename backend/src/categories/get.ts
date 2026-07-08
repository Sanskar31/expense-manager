import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE_NAME } from "../shared/db";
import { verifyToken } from "../auth/verifyToken";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log("Get Categories Event");
  try {
    const mobileNumber = verifyToken(event.cookies);
    if (!mobileNumber) {
      console.error("Unauthorized request");
      return { statusCode: 401, body: JSON.stringify({ message: "Unauthorized" }) };
    }

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
  } catch (error) {
    console.error("Error fetching categories:", error);
    return { statusCode: 500, body: JSON.stringify({ message: "Internal server error" }) };
  }
};
