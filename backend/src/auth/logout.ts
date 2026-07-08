import { APIGatewayProxyHandlerV2 } from "aws-lambda";

export const handler: APIGatewayProxyHandlerV2 = async () => {
  console.log("Logout User Event");
  return {
    statusCode: 200,
    headers: {
      "Set-Cookie": "token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
    },
    body: JSON.stringify({ message: "Logged out successfully" })
  };
};
