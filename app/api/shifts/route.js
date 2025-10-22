"use server";

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

// Retry helper for Graph API
async function fetchWithRetry(url, options, retries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(url, options);
    if (res.ok) return res;

    const text = await res.text().catch(() => "");
    if ([500, 502, 504].includes(res.status) && attempt < retries) {
      console.warn(`Retrying Graph request after ${res.status}... (Attempt ${attempt})`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    throw new Error(`Graph fetch failed ${res.status}: ${text}`);
  }
}

// Extract start/end
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

// Fetch all shifts
async function fetchAllShifts(teamId, accessToken) {
  const all = [];
  let url = `https://graph.microsoft.com/v1.0/teams/${teamId}/schedule/shifts?$top=200`;

  while (url) {
    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20000),
    });

    const json = await res.json().catch(() => ({}));
    const items = Array.isArray(json.value) ? json.value : [];
    all.push(...items);
    url = json["@odata.nextLink"] || null;
  }

  return all;
}

// Fetch all timecards
async function fetchAllTimeCards(teamId, accessToken) {
  const all = [];
  let url = `https://graph.microsoft.com/v1.0/teams/${teamId}/schedule/timeCards?$top=200`;

  while (url) {
    const res = await fetchWithRetry(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(20000),
    });

    const json = await res.json().catch(() => ({}));
    const items = Array.isArray(json.value) ? json.value : [];
    all.push(...items);
    url = json["@odata.nextLink"] || null;
  }

  return all;
}

// Resolve userId → email
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
      }

      hoursByEmail[email] = (hoursByEmail[email] || 0) + Number(hrs || 0);
    } catch {
      const key = graphUserId.toLowerCase().trim();
      hoursByEmail[key] = (hoursByEmail[key] || 0) + Number(hrs || 0);
    }
  }

  return hoursByEmail;
}

// MAIN GET handler
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
    const timeCardsByUser = {};

    // Organize timecards by user
    timeCards.forEach((tc) => {
      if (!tc.userId) return;
      if (!timeCardsByUser[tc.userId]) timeCardsByUser[tc.userId] = [];
      timeCardsByUser[tc.userId].push(tc);
    });

    // Go through shifts
    for (const shift of shifts) {
      const userId = shift.userId;
      if (!userId) continue;

      const { start, end } = extractStartEnd(shift);
      if (!start || !end) continue;

      const s = new Date(start);
      const e = new Date(end);
      if (s < monthStart || s >= nextMonthStart) continue;

      const scheduledHours = (e - s) / (1000 * 60 * 60);
      const note = (shift.sharedShift?.notes || shift.displayName || "").toLowerCase();

      const isRestDay = /rest\s*day/.test(note);
      const isSickLeave = /sick/.test(note);
      const isVacationLeave = /vacation/.test(note);
      const isLeave = isSickLeave || isVacationLeave;
      const isAbsent = note.includes("absent") && !isLeave && !isRestDay;

      if (!shiftDetailsPerUser[userId]) shiftDetailsPerUser[userId] = [];

      // Only count Regular Work Days as worked hours
      if (!isLeave && !isRestDay) {
        hoursById[userId] = (hoursById[userId] || 0) + scheduledHours;
      }

      const baseEntry = {
        start: s.toISOString(),
        end: e.toISOString(),
        scheduledHours,
        note,
        status: isRestDay
          ? "Rest Day"
          : isSickLeave
          ? "Sick Leave"
          : isVacationLeave
          ? "Vacation Leave"
          : isAbsent
          ? "Absent"
          : "Regular Work Day",
      };

      // Match with timecards if any
      if (timeCardsByUser[userId] && timeCardsByUser[userId].length > 0) {
        timeCardsByUser[userId].forEach((tc) => {
          const clockIn = tc.clockInEvent?.dateTime ? new Date(tc.clockInEvent.dateTime) : null;
          const clockOut = tc.clockOutEvent?.dateTime ? new Date(tc.clockOutEvent.dateTime) : null;

          if (clockIn && (clockIn < monthStart || clockIn >= nextMonthStart)) return;

          let totalBreakMinutes = 0;
          if (Array.isArray(tc.breaks)) {
            tc.breaks.forEach((b) => {
              const bs = b?.start?.dateTime ? new Date(b.start.dateTime) : null;
              const be = b?.end?.dateTime ? new Date(b.end.dateTime) : null;
              if (bs && be) totalBreakMinutes += (be - bs) / (1000 * 60);
            });
          }

          let workedHours = null;
          if (clockIn && clockOut) {
            workedHours = (clockOut - clockIn) / (1000 * 60 * 60);
            workedHours -= totalBreakMinutes / 60;
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
        // No timecard — still record
        shiftDetailsPerUser[userId].push({
          ...baseEntry,
          clockIn: null,
          clockOut: null,
          workedHours: null,
          breakMinutes: 0,
        });
      }
    }

    const shiftHoursPerUser = await resolveEmails(hoursById, session.accessToken);

    // Attach email mapping
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
