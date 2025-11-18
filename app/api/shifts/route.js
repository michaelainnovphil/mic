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

// Helper: compute period range
function getPeriodRange(period) {
  const now = new Date();
  let start, end;

  if (period === "daily") {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    end = new Date(start);
    end.setDate(start.getDate() + 1);
    return { start, end, isDaily: true };
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

  return { start, end, isDaily: false };
}

// Format YYYY-MM-DD
function formatDate(date) {
  return new Date(date).toISOString().split("T")[0];
}

// Extract start/end from shift
function extractStartEnd(shift) {
  const c = shift.sharedShift ?? shift.draftShift ?? shift;
  const start = c?.startDateTime ?? c?.start?.dateTime ?? c?.start ?? null;
  const end = c?.endDateTime ?? c?.end?.dateTime ?? c?.end ?? null;
  return { start, end };
}

// Convert userId to email via Graph
async function getUserEmail(userId, accessToken) {
  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}?$select=mail,userPrincipalName`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (res.ok) {
      const u = await res.json();
      return (u.mail || u.userPrincipalName || userId).toLowerCase().trim();
    }
    return userId.toLowerCase().trim();
  } catch {
    return userId.toLowerCase().trim();
  }
}

// Determine shift type (Present/Tardy/Absent) using earliest clock-in
function determineType(earliestClockIn, shiftStart) {
  if (!earliestClockIn) return "Absent";

  const clockInTime = new Date(earliestClockIn);
  const shiftCutoff = new Date(shiftStart);
  shiftCutoff.setUTCHours(0, 31, 0, 0); // 8:31 AM local = 00:31 UTC

  return clockInTime > shiftCutoff ? "Tardy" : "Present";
}

// MAIN HANDLER
export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const teamId = process.env.MS_TEAM_ID;
    if (!teamId)
      return NextResponse.json({ error: "Missing MS_TEAM_ID" }, { status: 500 });

    const url = new URL(req.url);
    const period = url.searchParams.get("period") || "monthly";
    const { start: periodStart, end: periodEnd } = getPeriodRange(period);

    // Fetch shifts and timecards
    const [shifts, timeCards] = await Promise.all([
      fetchAllShifts(teamId, session.accessToken),
      fetchAllTimeCards(teamId, session.accessToken),
    ]);

    const shiftDetailsPerUser = {};
    const timeCardsByUser = {};

    // Group timecards by user and day
    timeCards.forEach(tc => {
      if (!tc.userId) return;
      const userId = tc.userId.toLowerCase().trim();

      const clockIn = tc.clockInEvent?.dateTime ? new Date(tc.clockInEvent.dateTime) : null;
      const clockOut = tc.clockOutEvent?.dateTime ? new Date(tc.clockOutEvent.dateTime) : null;

      let breakMinutes = 0;
      if (Array.isArray(tc.breaks)) {
        tc.breaks.forEach(b => {
          const bs = b?.start?.dateTime ? new Date(b.start.dateTime) : null;
          const be = b?.end?.dateTime ? new Date(b.end.dateTime) : null;
          if (bs && be) breakMinutes += (be - bs) / (1000 * 60);
        });
      }

      function formatLocalDate(date, tzOffsetHours = 8) {
  const d = new Date(date);
  d.setHours(d.getHours() + tzOffsetHours); // convert UTC → local
  return d.toISOString().split("T")[0];
}

const dayKey = clockIn ? formatLocalDate(clockIn, 8) : null;

      if (!dayKey) return;

      if (!timeCardsByUser[userId]) timeCardsByUser[userId] = {};
      if (!timeCardsByUser[userId][dayKey]) timeCardsByUser[userId][dayKey] = [];
      timeCardsByUser[userId][dayKey].push({ clockIn, clockOut, breakMinutes });
    });

    // Process shifts
    for (const shift of shifts) {
      const userId = shift.userId?.toLowerCase().trim();
      if (!userId) continue;

      const { start, end } = extractStartEnd(shift);
      if (!start || !end) continue;

      const s = new Date(start);
      const e = new Date(end);
      if (s < periodStart || s >= periodEnd) continue;

      const dayKey = formatDate(s);
      const note =
        (shift.sharedShift?.notes ||
          shift.sharedShift?.displayName ||
          shift.draftShift?.notes ||
          shift.draftShift?.displayName ||
          shift.notes ||
          shift.displayName ||
          ""
        ).toLowerCase().trim();

      if (!shiftDetailsPerUser[userId]) shiftDetailsPerUser[userId] = {};

      let type = "On Leave/Other";
      let clockIn = null;
      let clockOut = null;
      let breakMinutes = 0;

      if (note.includes("regular work day")) {
        const userTimeCards = timeCardsByUser[userId]?.[dayKey] || [];

        if (userTimeCards.length > 0) {
          // Multiple clock-ins
          const earliestClockIn = userTimeCards.reduce((earliest, tc) => {
            if (!earliest) return tc.clockIn;
            return tc.clockIn < earliest ? tc.clockIn : earliest;
          }, null);

          const latestClockOut = userTimeCards.reduce((latest, tc) => {
            if (!tc.clockOut) return latest;
            if (!latest) return tc.clockOut;
            return tc.clockOut > latest ? tc.clockOut : latest;
          }, null);

          const totalBreakMinutes = userTimeCards.reduce((sum, tc) => sum + (tc.breakMinutes || 0), 0);

          clockIn = earliestClockIn ? earliestClockIn.toISOString() : null;
          clockOut = latestClockOut ? latestClockOut.toISOString() : null;
          breakMinutes = totalBreakMinutes;

          type = determineType(earliestClockIn, s);
        } else {
          type = "Absent";
        }
      } else if (note.includes("leave") || note.includes("rest")) {
        type = "On Leave/Rest Day";
      }

      shiftDetailsPerUser[userId][dayKey] = {
        date: dayKey,
        start: s.toISOString(),
        end: e.toISOString(),
        note,
        type,
        clockIn,
        clockOut,
        breakMinutes,
      };
    }

    // Fill missing days
    for (const userId of Object.keys(shiftDetailsPerUser)) {
      const userShifts = shiftDetailsPerUser[userId];
      let current = new Date(periodStart);
      while (current < periodEnd) {
        const dayKey = formatDate(current);
        if (!userShifts[dayKey]) {
          userShifts[dayKey] = {
            date: dayKey,
            start: null,
            end: null,
            note: "",
            type: "On Leave/Rest Day",
            clockIn: null,
            clockOut: null,
            breakMinutes: 0,
          };
        }
        current.setDate(current.getDate() + 1);
      }
    }


    // Convert userId => email
    const finalResult = {};
    for (const userId of Object.keys(shiftDetailsPerUser)) {
      const email = await getUserEmail(userId, session.accessToken);
      finalResult[email] = shiftDetailsPerUser[userId];
    }

    return NextResponse.json({ shiftDetailsPerUser: finalResult, period });
  } catch (error) {
    console.error("Shifts API error:", error?.message || error);
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}
