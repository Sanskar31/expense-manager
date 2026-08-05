import { verify } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";

export const verifyToken = (cookiesOrToken: string[] | string | undefined): string | null => {
  if (!cookiesOrToken || (Array.isArray(cookiesOrToken) && cookiesOrToken.length === 0)) {
    return null;
  }

  let token: string;
  if (Array.isArray(cookiesOrToken)) {
    const tokenCookie = cookiesOrToken.find(c => c.startsWith('token='));
    if (!tokenCookie) return null;
    token = tokenCookie.split('=')[1];
  } else {
    token = cookiesOrToken;
  }

  try {
    const decoded = verify(token, JWT_SECRET) as { mobileNumber: string };
    return decoded.mobileNumber;
  } catch (err) {
    return null;
  }
};
