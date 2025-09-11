// app/api/presence/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

const ATTENDANCE_CUTOFF = process.env.ATTENDANCE_CUTOFF ?? "08:00"; 
const MAX_USERS = 999;
const TEAM_ID = process.env.TEAM_ID; // ✅ Make sure this is set in env

function isoStartOfToday(tz = undefined) {
  const now = tz ? new Date(new Date().toLocaleString("en-US", { timeZone: tz })) : new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function isoEndOfToday(tz = undefined) {
  const now = tz ? new Date(new Date().toLocaleString("en-US", { timeZone: tz })) : new Date();
  now.setHours(23, 59, 59, 999);
  return now.toISOString();
}

function parseCutoffToTodayISO(cutoffHHmm, tz = undefined) {
  const [hh, mm] = (cutoffHHmm || "08:00").split(":").map(Number);
  const base = tz ? new Date(new Date().toLocaleString("en-US", { timeZone: tz })) : new Date();
  base.setHours(0, 0, 0, 0);
  base.setHours(hh, mm, 0, 0);
  return base.toISOString();
}

async function gFetch(token, path, init = {}) {
  const res = await fetch(
    path.startsWith("http") ? path : `https://graph.microsoft.com/v1.0${path}`,
    {
      ...init,
      headers: {
        ...(init.headers || {}),
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );
  let body = null;
  try {
    body = await res.json();
  } catch {}
  if (!res.ok) {
    const err = new Error(
      (body && (body.error?.message || body.message)) || `Graph ${res.status}`
    );
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

// ✅ New helper: Fetch and filter today's timeCards
async function fetchClockInsFromTimeCards(token) {
  if (!TEAM_ID) return {};
  const startISO = new Date(isoStartOfToday());
  const endISO = new Date(isoEndOfToday());

  let cards = [];
  let url = `/teams/${TEAM_ID}/schedule/timeCards`;
  for (let i = 0; i < 5 && url; i++) {
    const page = await gFetch(token, url);
    (page.value || []).forEach(c => cards.push(c));
    url = page["@odata.nextLink"]
      ? page["@odata.nextLink"].replace("https://graph.microsoft.com/v1.0", "")
      : null;
  }

  const today = {};
  for (const c of cards) {
    const ci = c.clockInEvent?.dateTime;
    if (!ci) continue;
    const dt = new Date(ci);
    if (dt >= startISO && dt <= endISO) {
      today[c.userId] = {
        clockIn: c.clockInEvent?.dateTime || null,
        clockOut: c.clockOutEvent?.dateTime || null,
        workedHours:
          c.clockInEvent?.dateTime && c.clockOutEvent?.dateTime
            ? (new Date(c.clockOutEvent.dateTime) - new Date(c.clockInEvent.dateTime)) / 3600000
            : null,
      };
    }
  }
  return today;
}

async function computeFromSignIns(token, cutoffISO, allowedIds = null) {
  const usersResp = await gFetch(
    token,
    `/users?$select=id,displayName,mail,userPrincipalName,accountEnabled,jobTitle,assignedLicenses&$top=${MAX_USERS}`
  );
  let users = usersResp.value || [];

  users = users
    .filter((u) => u.accountEnabled !== false)
    .filter((u) => (u.assignedLicenses?.length ?? 0) > 0)
    .filter((u) => u.jobTitle && !u.jobTitle.toLowerCase().includes("chief"));

  if (Array.isArray(allowedIds) && allowedIds.length > 0) {
    const allowedSet = new Set(allowedIds);
    users = users.filter((u) => allowedSet.has(u.id));
  }

  const startOfDayISO = isoStartOfToday();
  const signIns = [];
  let url = `/auditLogs/signIns?$filter=createdDateTime ge ${startOfDayISO}`;
  for (let i = 0; i < 10 && url; i++) {
    const page = await gFetch(token, url);
    (page.value || []).forEach((si) => signIns.push(si));
    url = page["@odata.nextLink"]
      ? page["@odata.nextLink"].replace("https://graph.microsoft.com/v1.0", "")
      : null;
  }

  const firstByUserId = new Map();
  for (const si of signIns) {
    const created = si.createdDateTime;
    if (!si.userId || !created) continue;
    const prev = firstByUserId.get(si.userId);
    if (!prev || new Date(created) < new Date(prev.createdDateTime)) {
      firstByUserId.set(si.userId, si);
    }
  }

  const timeCardData = await fetchClockInsFromTimeCards(token); // ✅ fetch clock-ins

  let present = 0;
  let onTime = 0;
  const attendanceDetails = [];

  for (const u of users) {
    const si = firstByUserId.get(u.id);
    const tc = timeCardData[u.id];

    if (si || tc) {
      present += 1;
      const firstLoginISO = si?.createdDateTime || tc?.clockIn;
      const wasOnTime = firstLoginISO
        ? new Date(firstLoginISO) <= new Date(cutoffISO)
        : false;
      if (wasOnTime) onTime += 1;

      attendanceDetails.push({
        userId: u.id,
        name: u.displayName || u.userPrincipalName || u.mail,
        email: u.mail || u.userPrincipalName,
        firstLogin: si?.createdDateTime || null,
        onTime: wasOnTime,
        status: wasOnTime ? "present" : "tardy",
        // ✅ new fields from timeCards
        clockIn: tc?.clockIn || null,
        clockOut: tc?.clockOut || null,
        workedHours: tc?.workedHours || null,
      });
    } else {
      attendanceDetails.push({
        userId: u.id,
        name: u.displayName || u.userPrincipalName || u.mail,
        email: u.mail || u.userPrincipalName,
        firstLogin: null,
        onTime: false,
        status: "absent",
        clockIn: null,
        clockOut: null,
        workedHours: null,
      });
    }
  }

  const total = users.length || 0;
  return {
    source: "auditLogs.signIns + timeCards",
    supportsTardiness: true,
    cutoff: ATTENDANCE_CUTOFF,
    total,
    present,
    percent: total ? Math.round((present / total) * 100) : 0,
    onTime,
    tardy: present - onTime,
    details: attendanceDetails,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cutoffISO = parseCutoffToTodayISO(ATTENDANCE_CUTOFF);
    const stats = await computeFromSignIns(session.accessToken, cutoffISO);

    return NextResponse.json(stats);
  } catch (err) {
    console.error("Presence API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal Server Error" },
      { status: err.status || 500 }
    );
  }
}
