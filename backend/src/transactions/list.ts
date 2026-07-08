import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE_NAME } from "../shared/db";
import { verifyToken } from "../auth/verifyToken";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log("List Transactions Event. Month:", event.queryStringParameters?.month);
  try {
    const mobileNumber = verifyToken(event.cookies);
    if (!mobileNumber) {
      console.error("Unauthorized request");
      return { statusCode: 401, body: JSON.stringify({ message: "Unauthorized" }) };
    }

    const month = event.queryStringParameters?.month; // Format: YYYY-MM
    const skPrefix = month ? `TX#${month}#` : `TX#`;

    console.log(`Querying transactions with SK prefix: ${skPrefix}`);
    const result = await db.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `USER#${mobileNumber}`,
        ":skPrefix": skPrefix
      },
      ScanIndexForward: false
    }));

    console.log(`Found ${result.Items?.length || 0} transactions`);
    return {
      statusCode: 200,
      body: JSON.stringify(result.Items || [])
    };
  } catch (error) {
    console.error("Error listing transactions:", error);
    return { statusCode: 500, body: JSON.stringify({ message: "Internal server error" }) };
  }
};
