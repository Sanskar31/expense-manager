import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE_NAME } from "../shared/db";
import { verifyToken } from "../auth/verifyToken";
import { randomUUID } from "crypto";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log("Update Category Event:", event.body);
  try {
    const mobileNumber = verifyToken(event.cookies);
    if (!mobileNumber) {
      console.error("Unauthorized request");
      return { statusCode: 401, body: JSON.stringify({ message: "Unauthorized" }) };
    }

    const { originalSK, name, icon, isArchived, subcategories } = JSON.parse(event.body || "{}");
    if (!name || typeof subcategories !== 'object') {
      console.error("Invalid category format", { name, subcategories });
      return { statusCode: 400, body: JSON.stringify({ message: "Invalid category format" }) };
    }

    const newSK = originalSK || `CAT#${randomUUID()}`;

    const item = {
      PK: `USER#${mobileNumber}`,
      SK: newSK,
      name,
      icon: icon || '🏷️',
      subcategories,
      isArchived: isArchived || false
    };

    console.log(`Saving category SK: ${newSK}`);
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: item
    }));

    console.log("Category saved successfully");
    return {
      statusCode: 200,
      body: JSON.stringify(item)
    };
  } catch (error) {
    console.error("Error updating category:", error);
    return { statusCode: 500, body: JSON.stringify({ message: "Internal server error" }) };
  }
};
