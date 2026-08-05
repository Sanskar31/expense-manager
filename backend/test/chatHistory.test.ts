import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { handler } from "../src/ai/chatHistory";
import jwt from "jsonwebtoken";

const ddbMock = mockClient(DynamoDBDocumentClient);

describe("chatHistory Lambda", () => {
  beforeEach(() => {
    ddbMock.reset();
    process.env.TABLE_NAME = "TestTable";
    process.env.JWT_SECRET = "secret";
  });

  const createEvent = (method: string, body?: any) => {
    const token = jwt.sign({ mobileNumber: "1234567890" }, "secret");
    return {
      requestContext: {
        http: { method }
      },
      cookies: [`auth_token=${token}`],
      body: body ? JSON.stringify(body) : undefined
    } as any;
  };

  it("handles GET request - returns messages", async () => {
    ddbMock.on(GetCommand).resolves({
      Item: {
        messages: [{ sender: "ai", text: "Hello" }]
      }
    });

    const response = await handler(createEvent("GET")) as any;
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].text).toBe("Hello");
  });

  it("handles GET request - returns empty array if no history", async () => {
    ddbMock.on(GetCommand).resolves({});

    const response = await handler(createEvent("GET")) as any;
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.messages).toEqual([]);
  });

  it("handles POST request - saves messages", async () => {
    ddbMock.on(PutCommand).resolves({});

    const response = await handler(createEvent("POST", { messages: [{ sender: "user", text: "Hi" }] })) as any;
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);

    const putCalls = ddbMock.commandCalls(PutCommand);
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0].args[0].input).toEqual({
      TableName: "TestTable",
      Item: {
        PK: "USER#1234567890",
        SK: "AI_HISTORY",
        messages: [{ sender: "user", text: "Hi" }]
      }
    });
  });

  it("handles POST request - rejects invalid body", async () => {
    const response = await handler(createEvent("POST", { notMessages: true })) as any;
    expect(response.statusCode).toBe(400);
  });

  it("handles DELETE request - clears history", async () => {
    ddbMock.on(DeleteCommand).resolves({});

    const response = await handler(createEvent("DELETE")) as any;
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);

    const deleteCalls = ddbMock.commandCalls(DeleteCommand);
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0].args[0].input).toEqual({
      TableName: "TestTable",
      Key: {
        PK: "USER#1234567890",
        SK: "AI_HISTORY"
      }
    });
  });

  it("rejects unauthorized access", async () => {
    const response = await handler({
      requestContext: { http: { method: "GET" } },
      cookies: [] // No token
    } as any) as any;
    
    expect(response.statusCode).toBe(401);
  });
});
