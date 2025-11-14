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
    c?.startDateTime ?? c?.start?.dateTime ?? c?.start ?? null;
  const end =
    c?.endDateTime ?? c?.end?.dateTime ?? c?.end ?? null;
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

// Map user IDs to emails
async function resolveEmails(hoursById, accessToken) {
  const entries = Object.entries(hoursById);
  const hoursByEmail = {};

  await Promise.all(
    entries.map(async ([graphUserId, hrs]) => {
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
    })
  );

  return hoursByEmail;
}

// 🟩 Helper to compute start/end for selected period
function getPeriodRange(period) {
  const now = new Date();
  let start, end;

  if (period === "daily") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(start);
    end.setDate(start.getDate() + 1);
  } else if (period === "weekly") {
    const currentDay = now.getDay(); // Sunday = 0
    const diffToMonday = (currentDay + 6) % 7;
    start = new Date(now);
    start.setDate(now.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    end = new Date(start);
    end.setDate(start.getDate() + 7);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }

  return { start, end };
}

//  MAIN HANDLER
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const teamId = process.env.MS_TEAM_ID;
    if (!teamId)
      return NextResponse.json({ error: "Missing MS_TEAM_ID" }, { status: 500 });

    // Get selected period (default: monthly)
    const url = new URL(req.url);
    const period = url.searchParams.get("period") || "monthly";
    const { start: periodStart, end: periodEnd } = getPeriodRange(period);

    // Fetch all shifts/timecards
    const [shifts, timeCards] = await Promise.all([
      fetchAllShifts(teamId, session.accessToken),
      fetchAllTimeCards(teamId, session.accessToken),
    ]);

    const hoursById = {};
    const shiftDetailsPerUser = {};
    const timeCardsByUser = {};

    // Group timecards by user
    timeCards.forEach((tc) => {
      if (!tc.userId) return;
      if (!timeCardsByUser[tc.userId]) timeCardsByUser[tc.userId] = [];
      timeCardsByUser[tc.userId].push(tc);
    });

    // Filter & process shifts
    for (const shift of shifts) {
      const userId = shift.userId;
      if (!userId) continue;

      const { start, end } = extractStartEnd(shift);
      const s = start ? new Date(start) : null;
      const e = end ? new Date(end) : null;

      // Skip shifts outside the selected period
      if (s && (s < periodStart || s >= periodEnd)) continue;

      const scheduledHours = s && e ? (e - s) / (1000 * 60 * 60) : 0;
      const note =
        (shift.sharedShift?.notes ||
          shift.sharedShift?.displayName ||
          shift.draftShift?.notes ||
          shift.draftShift?.displayName ||
          shift.notes ||
          shift.displayName ||
          ""
        ).toLowerCase()
          .trim();

      let type = "work";
      if (note.includes("rest day")) type = "rest";
      else if (note.includes("leave") || note.includes("time off") || shift.timeOffReasonId)
        type = "leave";

      if (!shiftDetailsPerUser[userId]) shiftDetailsPerUser[userId] = [];

      if (type === "work") {
        hoursById[userId] = (hoursById[userId] || 0) + scheduledHours;
      }

      const baseEntry = {
        start: s ? s.toISOString() : null,
        end: e ? e.toISOString() : null,
        scheduledHours,
        note,
        type,
      };

      if (type !== "work") {
        shiftDetailsPerUser[userId].push({
          ...baseEntry,
          clockIn: null,
          clockOut: null,
          workedHours: 0,
          breakMinutes: 0,
        });
        continue;
      }

      // Match timecards within same period
      if (timeCardsByUser[userId]?.length > 0) {
        timeCardsByUser[userId].forEach((tc) => {
          const clockIn = tc.clockInEvent?.dateTime ? new Date(tc.clockInEvent.dateTime) : null;
          const clockOut = tc.clockOutEvent?.dateTime ? new Date(tc.clockOutEvent.dateTime) : null;
          if (clockIn && (clockIn < periodStart || clockIn >= periodEnd)) return;

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

    // Return filtered results
    return NextResponse.json({ shiftHoursPerUser, shiftDetailsPerUser: shiftDetailsByEmail, period });
  } catch (error) {
    console.error("Shifts API error:", error?.message || error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
