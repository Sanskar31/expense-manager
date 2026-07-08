import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE_NAME } from "../shared/db";
import { verifyToken } from "../auth/verifyToken";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log("Delete Transaction Event:", event.body);
  try {
    const mobileNumber = verifyToken(event.cookies);
    if (!mobileNumber) {
      console.error("Unauthorized request");
      return { statusCode: 401, body: JSON.stringify({ message: "Unauthorized" }) };
    }

    const { SK } = JSON.parse(event.body || "{}");
    
    if (!SK) {
      console.error("Missing SK in delete transaction request");
      return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields" }) };
    }

    console.log(`Deleting transaction SK: ${SK}`);
    await db.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${mobileNumber}`,
        SK: SK
      }
    }));

    console.log("Transaction deleted successfully");
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Transaction deleted" })
    };
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return { statusCode: 500, body: JSON.stringify({ message: "Internal server error" }) };
  }
};
