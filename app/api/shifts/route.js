// app/api/shifts/route.js
import { NextResponse } from "next/server";

/**
 * Helper to read start/end ISO strings from a Graph shift object.
 * Handles sharedShift, draftShift, and nested start.dateTime shapes.
 */
function extractStartEnd(shift) {
  const candidate = shift.sharedShift ?? shift.draftShift ?? shift;


  const start =
    candidate?.startDateTime ??
    candidate?.start?.dateTime ??
    candidate?.start ??
    null;
  const end =
    candidate?.endDateTime ??
    candidate?.end?.dateTime ??
    candidate?.end ??
    null;

  return { start, end };
}

async function getAccessToken(tenantId, clientId, clientSecret) {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    scope: "https://graph.microsoft.com/.default",
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Token fetch failed ${res.status} ${t}`);
  }

  const json = await res.json();
  return json.access_token;
}

export async function GET() {
  const tenantId = process.env.AZURE_AD_TENANT_ID;
  const clientId = process.env.AZURE_AD_CLIENT_ID;
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
  const teamId = process.env.MS_TEAM_ID;

  if (!tenantId || !clientId || !clientSecret || !teamId) {
    console.error("Missing required env vars for /api/shifts");
    return NextResponse.json(
      { error: "Server misconfiguration: missing env vars" },
      { status: 500 }
    );
  }

  try {
    const accessToken = await getAccessToken(tenantId, clientId, clientSecret);
    if (!accessToken) {
      console.error("No access token obtained");
      return NextResponse.json({ error: "Auth failed" }, { status: 500 });
    }

    // Fetch shifts for the team
    const shiftsRes = await fetch(
      `https://graph.microsoft.com/v1.0/teams/${teamId}/schedule/shifts`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!shiftsRes.ok) {
      const text = await shiftsRes.text().catch(() => "");
      console.error("Graph shifts fetch failed:", shiftsRes.status, text);
      return NextResponse.json(
        { error: "Failed to fetch shifts from Graph" },
        { status: 500 }
      );
    }

    const shiftsData = await shiftsRes.json();
    const shifts = Array.isArray(shiftsData.value) ? shiftsData.value : [];

    // First pass: accumulate hours per Graph userId
    const hoursById = {};

    for (const shift of shifts) {
      const userId = shift.userId;
      if (!userId) continue;

      const { start, end } = extractStartEnd(shift);
      if (!start || !end) {
        // skip incomplete shifts
        continue;
      }

      const s = Date.parse(start);
      const e = Date.parse(end);
      if (isNaN(s) || isNaN(e) || e <= s) continue;

      const durationHours = (e - s) / (1000 * 60 * 60);
      hoursById[userId] = (hoursById[userId] || 0) + durationHours;
    }

    // Second pass: resolve Graph user id -> email
    const hoursByEmail = {};

    // Resolve in sequence to avoid complicated parallel throttling.
    for (const [graphUserId, hrs] of Object.entries(hoursById)) {
      try {
        const userRes = await fetch(
          `https://graph.microsoft.com/v1.0/users/${graphUserId}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!userRes.ok) {
  const txt = await userRes.text().catch(() => "");
  console.warn(`Failed to fetch user ${graphUserId}:`, userRes.status, txt);

  // Use object ID as fallback email key
  const fallbackKey = graphUserId.toLowerCase().trim();
  hoursByEmail[fallbackKey] = (hoursByEmail[fallbackKey] || 0) + Number(hrs || 0);
  continue;
}


        const userData = await userRes.json();
        const email = (userData.mail || userData.userPrincipalName || "")
          .toLowerCase()
          .trim();

        if (!email) {
  const fallbackKey = graphUserId.toLowerCase().trim();
  hoursByEmail[fallbackKey] = (hoursByEmail[fallbackKey] || 0) + Number(hrs || 0);
  continue;
}

        hoursByEmail[email] = (hoursByEmail[email] || 0) + Number(hrs || 0);
      } catch (err) {
        console.warn("Error resolving user to email for", graphUserId, err?.message || err);
        continue;
      }
    }

    console.log("Sending shiftHoursPerUser (count):", Object.keys(hoursByEmail).length);
    return NextResponse.json({ shiftHoursPerUser: hoursByEmail });
  } catch (error) {
    console.error("Shifts API error:", error?.message || error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
