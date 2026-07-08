import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
import { db, TABLE_NAME } from "../shared/db";
import { sign } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log("Login User Event");
  try {
    const { mobileNumber, password } = JSON.parse(event.body || "{}");

    if (!mobileNumber || !password) {
      console.error("Missing mobileNumber or password");
      return { statusCode: 400, body: JSON.stringify({ message: "Mobile number and password required" }) };
    }

    console.log(`Fetching user metadata for: ${mobileNumber}`);
    const userResult = await db.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${mobileNumber}`, SK: "METADATA" }
    }));

    const user = userResult.Item;
    if (!user) {
      console.error("User not found");
      return { statusCode: 401, body: JSON.stringify({ message: "Invalid credentials" }) };
    }

    console.log("Verifying password");
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      console.error("Invalid password");
      return { statusCode: 401, body: JSON.stringify({ message: "Invalid credentials" }) };
    }

    console.log("Login successful, generating token");
    const token = sign({ mobileNumber, name: user.name }, JWT_SECRET, { expiresIn: "7d" });

    return {
      statusCode: 200,
      headers: {
        "Set-Cookie": `token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`,
      },
      body: JSON.stringify({ message: "Login successful", user: { mobileNumber, name: user.name } })
    };
  } catch (error) {
    console.error("Error during login:", error);
    return { statusCode: 500, body: JSON.stringify({ message: "Internal server error" }) };
  }
};
