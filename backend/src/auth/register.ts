import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
import { db, TABLE_NAME } from "../shared/db";
import { sign } from "jsonwebtoken";

import { randomUUID } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";
const DEFAULT_CATEGORIES = [
  { id: "480f7031-f842-4d58-aecd-06f4f70eb543", name: "Shopping", icon: "🛍", subcategories: ["Clothing/Accessories", "Gifts", "Household Items", "Other Shopping"] },
  { id: "965712f3-cb36-4be7-844d-73191ec86ca9", name: "Food/Drink", icon: "🥪", subcategories: ["Groceries", "Office Food", "Online Delivery", "Other Food/Drink", "Restaurants"] },
  { id: "270c3433-0519-4148-9883-f69c164a3b54", name: "Investment", icon: "💰", subcategories: ["Mutual Funds", "PPF", "Real Estate"], isInvestment: true },
  { id: "fb0d1565-7c25-43f7-8c35-1ebe6c67f1a1", name: "Bill/Utilities", icon: "🧾", subcategories: ["Electricity", "Maid/Service", "Other Bill", "Phone/Internet", "Rent"] },
  { id: "dc65395b-8e0a-49c1-83b5-744131882de8", name: "Transportation", icon: "🚘", subcategories: ["Bus", "Cab", "Fuel", "Petrol"] },
  { id: "ab184285-1f29-4ac0-a3a6-55afa227a3f3", name: "Personal Care", icon: "❤️", subcategories: ["Doctor/Medicine", "Haircut", "Other Personal Care/Health"] },
  { id: "f4742392-4bf9-475d-86dd-a8767dd75352", name: "Entertainment", icon: "🍿", subcategories: ["Other", "Sports"] },
  { id: "a56d3369-6f04-4544-bb12-5dd0fbc4f79c", name: "Travel", icon: "✈️", subcategories: ["Flight Ticket", "Other Travel"] },
  { id: "55c918cf-0459-4508-9702-2b33bf0b3140", name: "Income", icon: "💰", subcategories: ["Salary"] }
];

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  console.log("Register User Event");
  try {
    const { mobileNumber, password, name } = JSON.parse(event.body || "{}");

    if (!mobileNumber || !password) {
      console.error("Missing mobileNumber or password");
      return { statusCode: 400, body: JSON.stringify({ message: "Mobile number and password required" }) };
    }

    // Check if user exists
    console.log(`Checking if user exists: ${mobileNumber}`);
    const userResult = await db.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `USER#${mobileNumber}`, SK: "METADATA" }
    }));

    if (userResult.Item) {
      console.error("User already exists");
      return { statusCode: 400, body: JSON.stringify({ message: "User already exists" }) };
    }

    console.log("Hashing password");
    const passwordHash = await bcrypt.hash(password, 12);

    // Save user
    console.log("Saving user metadata");
    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${mobileNumber}`,
        SK: "METADATA",
        passwordHash,
        name: name || "",
        createdAt: new Date().toISOString()
      }
    }));

    // Initialize Categories
    console.log("Initializing default categories for new user");
    for (const cat of DEFAULT_CATEGORIES) {
      await db.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `USER#${mobileNumber}`,
          SK: `CAT#${cat.id}`,
          name: cat.name,
          icon: cat.icon,
          subcategories: cat.subcategories.reduce((acc, sub) => ({ ...acc, [randomUUID()]: sub }), {}),
          isArchived: false,
          createdAt: new Date().toISOString()
        }
      }));
    }

    console.log("User registered successfully");
    const token = sign({ mobileNumber }, JWT_SECRET, { expiresIn: "7d" });

    return {
      statusCode: 201,
      headers: {
        "Set-Cookie": `token=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`,
      },
      body: JSON.stringify({ message: "User registered" })
    };
  } catch (error) {
    console.error("Error during registration:", error);
    return { statusCode: 500, body: JSON.stringify({ message: "Internal server error" }) };
  }
};
