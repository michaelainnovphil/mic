// middleware.js
import { withAuth } from "next-auth/middleware";

const allowedUsers = [
  "mdbarreda@innovphil.com",
  "smbernardo@innovphil.com",
  "carce@innovphil.com",
  "aarce@innovphil.com",
  "jlolfindo@innovphil.com",
  "ejgonzales@innovphil.com",
];

export default withAuth(
  function middleware(req) {
    
    const userEmail = req.nextauth.token?.email;
    if (!userEmail || !allowedUsers.includes(userEmail)) {
      return new Response("Access Denied", { status: 403 });
    }
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token, // Basic auth check
    },
  }
);

export const config = {
  matcher: ["/overview"], // Protect only the /overview route
};