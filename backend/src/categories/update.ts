import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE_NAME } from "../shared/db";
import { withAuth } from "../shared/withAuth";
import { randomUUID } from "crypto";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async (event, mobileNumber) => {
  console.log("Update Category Event:", event.body);

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
});
