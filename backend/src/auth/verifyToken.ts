import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

export const verifyToken = (cookies: string[] | undefined): string | null => {
  if (!cookies || cookies.length === 0) {
    return null;
  }

  const tokenCookie = cookies.find(c => c.startsWith('token='));
  if (!tokenCookie) {
    return null;
  }

  const token = tokenCookie.split('=')[1];
  try {
    const decoded = verify(token, JWT_SECRET) as { mobileNumber: string };
    return decoded.mobileNumber;
  } catch (err) {
    return null;
  }
};
