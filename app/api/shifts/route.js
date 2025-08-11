// app/api/shifts/route.js

import { NextResponse } from "next/server";

export async function GET() {
  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  const teamId = process.env.MS_TEAM_ID;



  try {
    // 1. Get token from Entra App
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          scope: "https://graph.microsoft.com/.default",
          client_secret: clientSecret,
          grant_type: "client_credentials",
        }),
      }
    );

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      console.error("Failed to get access token:", tokenData);
      return NextResponse.json({ error: "Access token fetch failed" }, { status: 500 });
    }

    // 2. Fetch shifts from Microsoft Teams
    const res = await fetch(`https://graph.microsoft.com/v1.0/teams/${teamId}/schedule/shifts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    const data = await res.json();

    if (!data.value) {
      console.error("Invalid shift data response:", data);
      return NextResponse.json({ error: "Invalid shift response" }, { status: 500 });
    }

    const shiftHoursPerUser = {};

    for (const shift of data.value) {
      const userId = shift.userId;
      const shared = shift.sharedShift;

      if (!shared || !shared.startDateTime || !shared.endDateTime) continue;

      const start = new Date(shared.startDateTime);
      const end = new Date(shared.endDateTime);

      const durationInHours = (end - start) / (1000 * 60 * 60); // milliseconds → hours

      if (!shiftHoursPerUser[userId]) {
        shiftHoursPerUser[userId] = 0;
      }

      shiftHoursPerUser[userId] += durationInHours;
    }

    return NextResponse.json({ shiftHoursPerUser });
  } catch (error) {
    console.error("Shifts API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
