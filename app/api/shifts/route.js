// app/api/shifts/route.js
"use server";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

function extractStartEnd(shift) {
  const c = shift.sharedShift ?? shift.draftShift ?? shift;
  const start =
    c?.startDateTime ??
    c?.start?.dateTime ??
    c?.start ??
    null;
  const end =
    c?.endDateTime ??
    c?.end?.dateTime ??
    c?.end ??
    null;
  return { start, end };
}

async function fetchAllShifts(teamId, accessToken) {
  const all = [];
  let url = `https://graph.microsoft.com/v1.0/teams/${teamId}/schedule/shifts?$top=200`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Graph shifts fetch failed ${res.status}: ${text}`);
    }

    const json = await res.json();
    const items = Array.isArray(json.value) ? json.value : [];
    all.push(...items);
    url = json["@odata.nextLink"] || null;
  }

  return all;
}

// Resolve Graph user objectId -> email
async function resolveEmails(hoursById, accessToken) {
  const hoursByEmail = {};

  for (const [graphUserId, hrs] of Object.entries(hoursById)) {
    try {
      const res = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(graphUserId)}?$select=mail,userPrincipalName`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      let email = graphUserId.toLowerCase().trim();
      if (res.ok) {
        const u = await res.json();
        email = (u.mail || u.userPrincipalName || email).toLowerCase().trim();
      } else {
        const txt = await res.text().catch(() => "");
        console.warn(`User lookup failed for ${graphUserId}: ${res.status} ${txt}`);
      }

      hoursByEmail[email] = (hoursByEmail[email] || 0) + Number(hrs || 0);
    } catch (e) {
      console.warn(`Error resolving user ${graphUserId}:`, e?.message || e);
      const key = graphUserId.toLowerCase().trim();
      hoursByEmail[key] = (hoursByEmail[key] || 0) + Number(hrs || 0);
    }
  }

  return hoursByEmail;
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const teamId = process.env.MS_TEAM_ID;
    if (!teamId) {
      return NextResponse.json({ error: "Missing MS_TEAM_ID" }, { status: 500 });
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const shifts = await fetchAllShifts(teamId, session.accessToken);

    // Sum hours per Graph userId for current month, including rest days as 0 hours
    const hoursById = {};
    const shiftDetailsPerUser = {};

    shifts.forEach((shift) => {
      const userId = shift.userId;
      if (!userId) return;

      const { start, end } = extractStartEnd(shift);
      if (!start || !end) return;

      const s = new Date(start);
      const e = new Date(end);

      if (s >= monthStart && s < nextMonthStart) {
        const hours = (e - s) / (1000 * 60 * 60);

        hoursById[userId] = (hoursById[userId] || 0) + hours;

        if (!shiftDetailsPerUser[userId]) shiftDetailsPerUser[userId] = [];
        shiftDetailsPerUser[userId].push({
          start: s.toISOString(),
          end: e.toISOString(),
          hours,
          note: shift.sharedShift?.notes || shift.displayName || "",
        });
      }
    });

    const shiftHoursPerUser = await resolveEmails(hoursById, session.accessToken);

    // Attach shift details per email for frontend use
    const shiftDetailsByEmail = {};
    for (const [userId, details] of Object.entries(shiftDetailsPerUser)) {
      const email = Object.keys(shiftHoursPerUser).find(
        (e) => e.toLowerCase().trim() === userId.toLowerCase().trim()
      );
      if (email) shiftDetailsByEmail[email] = details;
    }

    return NextResponse.json({ shiftHoursPerUser, shiftDetailsPerUser: shiftDetailsByEmail });
  } catch (error) {
    console.error("Shifts API error:", error?.message || error);
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
