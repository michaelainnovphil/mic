// app/api/public-hr-stats/route.js
import { NextResponse } from "next/server";
// Import your DB/client logic here

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "daily"; // daily, weekly, monthly

    // Fetch shifts and users (similar to HR page)
    const shiftsRes = await fetch(`${process.env.INTERNAL_API_URL}/api/shifts?period=${period}`);
    const usersRes = await fetch(`${process.env.INTERNAL_API_URL}/api/users`);
    const daRes = await fetch(`${process.env.INTERNAL_API_URL}/api/disciplinary`);

    if (!shiftsRes.ok || !usersRes.ok) {
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }

    const rawShiftData = await shiftsRes.json();
    const usersData = await usersRes.json();
    const daData = await daRes.json();

    const validUsers = usersData.value.filter(
      (u) => u.jobTitle && u.jobTitle.trim() !== "" && !u.jobTitle.toLowerCase().includes("chief")
    );

    const userStats = {};

    validUsers.forEach((u) => {
      const emailKey = (u.mail || u.userPrincipalName || "").toLowerCase();
      const userShiftsObj = rawShiftData.shiftDetailsPerUser?.[emailKey] || {};

      const userShifts = Object.values(userShiftsObj).map((shift) => {
        let status = shift.type || "Absent";
        if (shift.clockIn) {
          const loginTime = new Date(shift.clockIn);
          const shiftStart = new Date(shift.start);
          const cutoff = new Date(shiftStart);
          cutoff.setHours(8, 31, 0, 0);
          status = loginTime <= cutoff ? "Present" : "Tardy";
        }
        return { status, breakMinutes: shift.breakMinutes || 0 };
      });

      const totalPresent = userShifts.filter((s) => s.status === "Present").length;
      const totalTardy = userShifts.filter((s) => s.status === "Tardy").length;
      const totalShifts = userShifts.length;

      // Percentages (as in HR page)
      const attendance = totalPresent > 0 ? 100 : 0; // Simplified: 100% if any present
      const tardiness = totalShifts > 0 ? Math.round((totalTardy / totalShifts) * 100) : 0;
      const adherence = userShifts.some((s) => s.breakMinutes > 75) ? 0 : 100;
      const da = daData[u.id]?.length > 0 ? 0 : 100;

      userStats[emailKey] = { attendance, tardiness, adherence, da };
    });

    return NextResponse.json({ userStats });
  } catch (error) {
    console.error("Error in public-hr-stats:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

