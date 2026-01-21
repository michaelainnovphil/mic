// app/api/public-hr-stats/route.js
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getAppAccessToken } from "@/utils/getAppAccessToken";

const MAX_USERS = 999;
const ATTENDANCE_CUTOFF = process.env.ATTENDANCE_CUTOFF ?? "08:00";

function isoStartOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.toISOString();
}

function parseCutoffToTodayISO(cutoffHHmm = "08:00") {
  const [hh, mm] = (cutoffHHmm || "08:00").split(":").map(Number);
  const base = new Date();
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

async function getAttendanceData(token, startDate = null) {
  const startOfPeriodISO = startDate ? startDate.toISOString() : isoStartOfToday();
  const cutoffISO = parseCutoffToTodayISO(ATTENDANCE_CUTOFF);

  const usersResp = await gFetch(
    token,
    `/users?$select=id,displayName,mail,userPrincipalName,accountEnabled,jobTitle,assignedLicenses&$top=${MAX_USERS}`
  );
  let users = (usersResp.value || [])
    .filter((u) => u.accountEnabled !== false)
    .filter((u) => (u.assignedLicenses?.length ?? 0) > 0)
    .filter((u) => u.jobTitle && !u.jobTitle.toLowerCase().includes("chief"));

  const signIns = [];
  let url = `/auditLogs/signIns?$filter=createdDateTime ge ${startOfPeriodISO}`;
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

  const present = [];
  const tardy = [];
  const absent = [];
  const userStats = {};

  for (const u of users) {
    const si = firstByUserId.get(u.id);
    const userEmail = u.mail || u.userPrincipalName;
    const userRecord = {
      userId: u.id,
      name: u.displayName || userEmail,
      email: userEmail,
    };

    if (si) {
      const firstLoginISO = si.createdDateTime;
      const wasOnTime = new Date(firstLoginISO) <= new Date(cutoffISO);
      userRecord.firstLogin = firstLoginISO;
      userRecord.onTime = wasOnTime;
      userRecord.status = wasOnTime ? "present" : "tardy";

      if (wasOnTime) {
        present.push(userRecord);
      } else {
        tardy.push(userRecord);
      }
    } else {
      userRecord.firstLogin = null;
      userRecord.onTime = false;
      userRecord.status = "absent";
      absent.push(userRecord);
    }

    userStats[userEmail] = {
      status: userRecord.status,
      onTime: userRecord.onTime,
    };
  }

  return {
    present,
    tardy,
    absent,
    userStats,
    totals: {
      total: users.length,
      present: present.length,
      tardy: tardy.length,
      absent: absent.length,
    },
  };
}

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "daily";

    const token = await getAppAccessToken();
    if (!token) {
      return NextResponse.json(
        { error: "Failed to obtain access token" },
        { status: 500 }
      );
    }

    let startDate = null;
    if (period === "daily") {
      startDate = null; // Today
    } else if (period === "weekly") {
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === "monthly") {
      startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
    }

    const attendanceData = await getAttendanceData(token, startDate);

    return NextResponse.json({
      [period]: attendanceData,
      userStats: attendanceData.userStats,
    });
  } catch (error) {
    console.error("Error in /api/public-hr-stats:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
