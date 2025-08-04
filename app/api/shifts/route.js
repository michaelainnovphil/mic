import { getToken } from "next-auth/jwt";

export async function GET(req) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const teamId = process.env.TEAM_ID; // Set this in .env
  const userId = token.sub;

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/teams/${teamId}/schedule/shifts`,
    {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    return new Response(JSON.stringify(error), { status: response.status });
  }

  const data = await response.json();

  const userShifts = data.value.filter(
    (shift) => shift.userId === userId
  );

  return new Response(JSON.stringify(userShifts), { status: 200 });
}
