// app/api/presence/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

// Config
const ATTENDANCE_CUTOFF = process.env.ATTENDANCE_CUTOFF ?? "08:30"; // HH:mm (24h), local org time
const MAX_USERS = 999; // guardrail for /users page size

/**
 * Helpers
 */
function isoStartOfToday(tz = undefined) {
  // We’ll use server time if no TZ is provided. For production, pass your org timezone.
  const now = tz ? new Date(new Date().toLocaleString("en-US", { timeZone: tz })) : new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function parseCutoffToTodayISO(cutoffHHmm, tz = undefined) {
  const [hh, mm] = (cutoffHHmm || "08:30").split(":").map(Number);
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
  // Try to parse JSON always
  let body = null;
  try { body = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error((body && (body.error?.message || body.message)) || `Graph ${res.status}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/**
 * Try 1 (requires Entra ID P1/P2 + AuditLog.Read.All):
 * - Get users
 * - Query auditLogs/signIns since start of day
 * - Map first interactive sign-in per user
 */
async function computeFromSignIns(token, cutoffISO) {
  // 1) Load users (limit to enabled, with jobTitle/mail if you want)
  // Adjust $select to what you need in your UI
  const usersResp = await gFetch(
    token,
    `/users?$select=id,displayName,mail,userPrincipalName,accountEnabled,jobTitle&$top=${MAX_USERS}`
  );
  const users = usersResp.value || [];
  const enabledUsers = users.filter(u => u.accountEnabled !== false);

  // 2) Pull sign-ins since midnight (paginate if needed)
  const startOfDayISO = isoStartOfToday();
  const signIns = [];
  let url = `/auditLogs/signIns?$filter=createdDateTime ge ${startOfDayISO}`;
  // We’ll page a few times to be safe
  for (let i = 0; i < 10 && url; i++) {
    const page = await gFetch(token, url);
    (page.value || []).forEach(si => signIns.push(si));
    url = page["@odata.nextLink"] ? page["@odata.nextLink"].replace("https://graph.microsoft.com/v1.0", "") : null;
  }

  // 3) Determine the first interactive sign-in per user (some entries can be non-interactive)
  const firstByUserId = new Map();
  for (const si of signIns) {
    // Filter to interactive user sign-ins
    // Common hint: signInEventTypes may contain "interactiveUser"
    const created = si.createdDateTime;
    if (!si.userId || !created) continue;

    // If it’s the earliest, store it
    const prev = firstByUserId.get(si.userId);
    if (!prev || new Date(created) < new Date(prev.createdDateTime)) {
      firstByUserId.set(si.userId, si);
    }
  }

  // 4) Compute attendance & tardiness
  let present = 0;
  let onTime = 0;
  const attendanceDetails = [];

  for (const u of enabledUsers) {
    const si = firstByUserId.get(u.id);
    if (si) {
      present += 1;
      const firstLoginISO = si.createdDateTime;
      const wasOnTime = new Date(firstLoginISO) <= new Date(cutoffISO);
      if (wasOnTime) onTime += 1;

      attendanceDetails.push({
        userId: u.id,
        name: u.displayName || u.userPrincipalName || u.mail,
        email: u.mail || u.userPrincipalName,
        firstLogin: firstLoginISO,
        onTime: wasOnTime,
      });
    } else {
      attendanceDetails.push({
        userId: u.id,
        name: u.displayName || u.userPrincipalName || u.mail,
        email: u.mail || u.userPrincipalName,
        firstLogin: null,
        onTime: false,
      });
    }
  }

  const total = enabledUsers.length || 0;
  return {
    source: "auditLogs.signIns",
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

/**
 * Try 2 (fallback, no premium needed):
 * - Get users
 * - Chunk user IDs and call communications/getPresencesByUserId
 *   Count "present now" as not Offline/Away
 *   (No way to compute “tardy today” with presence; it’s a snapshot.)
 */
async function computeFromPresenceSnapshot(token) {
  const usersResp = await gFetch(
    token,
    `/users?$select=id,displayName,mail,userPrincipalName,accountEnabled&$top=${MAX_USERS}`
  );
  const users = (usersResp.value || []).filter(u => u.accountEnabled !== false);
  const ids = users.map(u => u.id);

  const chunks = [];
  for (let i = 0; i < ids.length; i += 100) chunks.push(ids.slice(i, i + 100));

  const presences = [];
  for (const batch of chunks) {
    const body = { ids: batch };
    try {
      const p = await gFetch(token, `/communications/getPresencesByUserId`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      (p.value || []).forEach(x => presences.push(x));
    } catch (e) {
      
      if (e?.status === 403) {
        return {
          source: "presence.snapshot",
          supportsTardiness: false,
          cutoff: ATTENDANCE_CUTOFF,
          total: users.length,
          present: 0,
          percent: 0,
          onTime: 0,
          tardy: 0,
          details: [],
          warning: "Missing Presence.Read.All or no Teams license; cannot read presence.",
        };
      }
      throw e;
    }
  }

  // Count “present now” as anyone not Offline or Away
  const presentNowIds = new Set(
    presences
      .filter(p => p && p.availability && !["offline", "away"].includes(String(p.availability).toLowerCase()))
      .map(p => p.id)
  );

  const details = users.map(u => ({
    userId: u.id,
    name: u.displayName || u.userPrincipalName || u.mail,
    email: u.mail || u.userPrincipalName,
    presentNow: presentNowIds.has(u.id),
  }));

  const present = details.filter(d => d.presentNow).length;
  const total = users.length;

  return {
    source: "presence.snapshot",
    supportsTardiness: false,
    cutoff: ATTENDANCE_CUTOFF,
    total,
    present,
    percent: total ? Math.round((present / total) * 100) : 0,
    onTime: 0,
    tardy: 0,
    details,
    note:
      "Snapshot presence cannot tell who logged in today or who was late. For true attendance/tardiness, enable Entra ID P1/P2 and AuditLog.Read.All or use Teams Shifts timecards.",
  };
}

/**
 * Route handler
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const token = session?.accessToken;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cutoffISO = parseCutoffToTodayISO(ATTENDANCE_CUTOFF);

    // Try premium sign-ins first
    try {
      const fromSignIns = await computeFromSignIns(token, cutoffISO);
      return NextResponse.json(fromSignIns);
    } catch (e) {
      // If premium or permission missing, fall back to presence
      const code =
        e?.body?.error?.code ||
        e?.body?.code ||
        e?.code ||
        "";

      const premiumLike =
        code === "Authentication_RequestFromNonPremiumTenantOrB2CTenant" ||
        code === "Authentication_MSGraphPermissionMissing" ||
        e?.status === 403;

      if (!premiumLike) {
        // Some other error — bubble up
        throw e;
      }

      // Fallback
      const snapshot = await computeFromPresenceSnapshot(token);
      return NextResponse.json(snapshot);
    }
  } catch (err) {
    console.error("presence route error:", err);
    return NextResponse.json(
      { error: "Failed to compute attendance", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
