// app/api/clockins/route.js
import { NextResponse } from "next/server";
import { getGraphClient } from "@/lib/graphClient";

export async function GET() {
  try {
    const client = await getGraphClient();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const timeCardsRes = await client
      .api("/teamwork/timeCards")
      .expand("timeCardEvent")
      .get();

    const results = (timeCardsRes?.value || [])
      .map((tc) => {
        const userId = tc.userId || tc.employeeId || null;
        const clockIn = tc.clockInEvent?.dateTime
          ? new Date(tc.clockInEvent.dateTime)
          : null;
        const clockOut = tc.clockOutEvent?.dateTime
          ? new Date(tc.clockOutEvent.dateTime)
          : null;

        if (!clockIn || clockIn < monthStart || clockIn >= nextMonthStart) {
          return null;
        }

        return {
          userId,
          clockInTime: clockIn.toISOString(),
          clockOutTime: clockOut ? clockOut.toISOString() : null,
        };
      })
      .filter(Boolean);

    return NextResponse.json(results);
  } catch (err) {
    console.error("Clock-ins fetch failed", err);
    // Always return JSON, even on error
    return NextResponse.json([], { status: 200 });
  }
}
