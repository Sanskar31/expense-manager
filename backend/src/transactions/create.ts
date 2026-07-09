import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE_NAME } from "../shared/db";
import { withAuth } from "../shared/withAuth";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async (event, mobileNumber) => {
  console.log("Create Transaction Event:", event.body);
  const { type, amount, categoryId, subcategoryId, description, paymentMode, timestamp, originalSK } = JSON.parse(event.body || "{}");
  
  if (!type || amount === undefined || !categoryId || description === undefined || !timestamp) {
    console.error("Missing required fields", { type, amount, categoryId, description, timestamp });
    return { statusCode: 400, body: JSON.stringify({ message: "Missing required fields" }) };
  }

  // timestamp format expected: ISO String e.g., 2026-07-08T10:00:00Z
  const date = new Date(timestamp);
  const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  
  const item: Record<string, unknown> = {
    PK: `USER#${mobileNumber}`,
    SK: `TX#${month}#${timestamp}`,
    type, // DEBIT or CREDIT
    amount,
    categoryId,
    description,
    timestamp
  };

  if (subcategoryId) {
    item.subcategoryId = subcategoryId;
  }

  if (paymentMode) {
    item.paymentMode = paymentMode;
  }

  if (originalSK) {
    console.log(`Updating existing transaction. Deleting old SK: ${originalSK}`);
    const { DeleteCommand } = require("@aws-sdk/lib-dynamodb");
    await db.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `USER#${mobileNumber}`,
        SK: originalSK
      }
    }));
  }

  console.log(`Saving new transaction SK: ${item.SK}`);
  await db.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item
  }));

  console.log("Transaction created successfully");
  return {
    statusCode: 201,
    body: JSON.stringify(item)
  };
});
