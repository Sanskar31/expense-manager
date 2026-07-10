import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE_NAME } from "../shared/db";
import { withAuth } from "../shared/withAuth";

const ADMIN_NUMBER = "+919828376660";

export const handler: APIGatewayProxyHandlerV2 = withAuth(async (event, mobileNumber) => {
  console.log("Admin Users List Event triggered by:", mobileNumber);

  if (mobileNumber !== ADMIN_NUMBER) {
    console.warn(`Unauthorized admin access attempt by: ${mobileNumber}`);
    return {
      statusCode: 403,
      body: JSON.stringify({ message: "Forbidden: Admin access only" })
    };
  }

  try {
    const data = await db.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "begins_with(PK, :pkPrefix)",
      ExpressionAttributeValues: {
        ":pkPrefix": "USER#"
      }
    }));

    const items = data.Items || [];
    
    // Group items by user
    const usersMap = new Map<string, { mobileNumber: string; name: string; txCount: number }>();

    items.forEach(item => {
      const userMobile = item.PK.replace("USER#", "");
      if (!usersMap.has(userMobile)) {
        usersMap.set(userMobile, { mobileNumber: userMobile, name: "Unknown", txCount: 0 });
      }

      const userData = usersMap.get(userMobile)!;

      if (item.SK === "METADATA") {
        userData.name = item.name || "Unknown";
      } else if (item.SK.startsWith("TX#")) {
        userData.txCount += 1;
      }
    });

    const result = Array.from(usersMap.values());

    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error("Error fetching admin users:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal server error" })
    };
  }
});
