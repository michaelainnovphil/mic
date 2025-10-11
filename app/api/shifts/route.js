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

    const json = await res.json().catch(() => ({}));
    const items = Array.isArray(json.value) ? json.value : [];
    all.push(...items);
    url = json["@odata.nextLink"] || null;
  }

  return all;
}

async function fetchAllTimeCards(teamId, accessToken) {
  const all = [];
  let url = `https://graph.microsoft.com/v1.0/teams/${teamId}/schedule/timeCards?$top=200`;

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Graph timeCards fetch failed ${res.status}: ${text}`);
    }

    const json = await res.json().catch(() => ({}));
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
    const timeCards = await fetchAllTimeCards(teamId, session.accessToken);

    const hoursById = {};
    const shiftDetailsPerUser = {};

    // Organize timecards by userId
    const timeCardsByUser = {};
    timeCards.forEach((tc) => {
      if (!tc.userId) return;
      if (!timeCardsByUser[tc.userId]) timeCardsByUser[tc.userId] = [];
      timeCardsByUser[tc.userId].push(tc);
    });

    shifts.forEach((shift) => {
      const userId = shift.userId;
      if (!userId) return;

      const { start, end } = extractStartEnd(shift);
      if (!start || !end) return;

      const s = new Date(start);
      const e = new Date(end);

      if (s >= monthStart && s < nextMonthStart) {
        const scheduledHours = (e - s) / (1000 * 60 * 60);

        hoursById[userId] = (hoursById[userId] || 0) + scheduledHours;

        if (!shiftDetailsPerUser[userId]) shiftDetailsPerUser[userId] = [];

        // Base entry
        const baseEntry = {
          start: s.toISOString(),
          end: e.toISOString(),
          scheduledHours,
          note: shift.sharedShift?.notes || shift.displayName || "",
        };

        // Merge in timeCards if available
        if (timeCardsByUser[userId] && timeCardsByUser[userId].length > 0) {
          timeCardsByUser[userId].forEach((tc) => {
            const clockIn = tc.clockInEvent?.dateTime
              ? new Date(tc.clockInEvent.dateTime)
              : null;
            const clockOut = tc.clockOutEvent?.dateTime
              ? new Date(tc.clockOutEvent.dateTime)
              : null;

            if (
              clockIn &&
              (clockIn < monthStart || clockIn >= nextMonthStart)
            ) {
              return; // skip this timecard
            }

            // 
            let totalBreakMinutes = 0;
            if (Array.isArray(tc.breaks)) {
              tc.breaks.forEach((b) => {
                const bs = b?.start?.dateTime ? new Date(b.start.dateTime) : null;
                const be = b?.end?.dateTime ? new Date(b.end.dateTime) : null;
                if (bs && be) {
                  totalBreakMinutes += (be - bs) / (1000 * 60);
                }
              });
            }

            // Compute worked hours
            let workedHours = null;
            if (clockIn && clockOut) {
              workedHours = (clockOut - clockIn) / (1000 * 60 * 60);
              workedHours -= totalBreakMinutes / 60; // subtract breaks
            }

            shiftDetailsPerUser[userId].push({
              ...baseEntry,
              clockIn: clockIn ? clockIn.toISOString() : null,
              clockOut: clockOut ? clockOut.toISOString() : null,
              workedHours,
              breakMinutes: totalBreakMinutes,
            });
          });
        } else {
          // no clock-ins
          shiftDetailsPerUser[userId].push({
            ...baseEntry,
            clockIn: null,
            clockOut: null,
            workedHours: null,
            breakMinutes: 0,
          });
        }
      }
    });

    const shiftHoursPerUser = await resolveEmails(hoursById, session.accessToken);

    // Attach shift details per email for frontend use
    const shiftDetailsByEmail = {};
    for (const [userId, details] of Object.entries(shiftDetailsPerUser)) {
      try {
        const res = await fetch(
          `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}?$select=mail,userPrincipalName`,
          { headers: { Authorization: `Bearer ${session.accessToken}` } }
        );

        if (res.ok) {
          const u = await res.json();
          const email = (u.mail || u.userPrincipalName || userId).toLowerCase().trim();
          shiftDetailsByEmail[email] = details;
        } else {
          shiftDetailsByEmail[userId.toLowerCase().trim()] = details;
        }
      } catch {
        shiftDetailsByEmail[userId.toLowerCase().trim()] = details;
      }
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
