import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE_NAME } from "../shared/db";
import { withAuth } from "../shared/withAuth";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async (event, mobileNumber) => {
  console.log("Delete Transaction Event:", event.body);

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
});
