import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { verifyToken } from "../auth/verifyToken";

type AuthenticatedHandler = (
  event: APIGatewayProxyEventV2,
  mobileNumber: string
) => Promise<APIGatewayProxyResultV2>;

export const withAuth = (handler: AuthenticatedHandler) => {
  return async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
    try {
      const mobileNumber = verifyToken(event.cookies);
      if (!mobileNumber) {
        console.warn("Unauthorized request: Invalid or missing token");
        return {
          statusCode: 401,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Unauthorized" }),
        };
      }

      return await handler(event, mobileNumber);
    } catch (error) {
      console.error("Unhandled error in withAuth wrapper:", error);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Internal server error" }),
      };
    }
  };
};
