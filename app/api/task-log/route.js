// api/task-log/route.js

import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import TaskLog from "@/lib/models/TaskLog";

export async function POST(req) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const { email, taskId, task, taskType, description, durationSeconds, timestamp } = body;

    if (!email || !taskId || typeof durationSeconds !== "number") {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 });
    }

    const newLog = new TaskLog({
      email,
      taskId,
      task,
      taskType,
      description,
      durationSeconds,
      timestamp,
    });

    const savedLog = await newLog.save();

    return NextResponse.json({ success: true, log: savedLog }, { status: 201 });
  } catch (err) {
    console.error("Error in POST /api/task-log:", err);
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
