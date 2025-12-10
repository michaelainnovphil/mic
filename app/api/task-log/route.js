import { NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import TaskLog from "@/lib/models/TaskLog";

export async function POST(req) {
  try {
    await connectToDatabase();
    const body = await req.json();

    console.log("Incoming /api/task-log payload:", body);

    // Normalize email
    let email = body.email || body.user;
if (Array.isArray(email)) {
  email = email[0];
}
email = email.toLowerCase();


    const taskId = body.taskId;
    const task = body.task || "";
    const taskType = body.taskType || "";
    const description = body.description || "";

    // Normalize duration → always store as durationSeconds
    const durationSeconds =
      typeof body.durationSeconds === "number"
        ? body.durationSeconds
        : typeof body.duration === "number"
        ? body.duration
        : 0;

    const timestamp = body.timestamp ? new Date(body.timestamp) : new Date();

    if (!email || !taskId || typeof durationSeconds !== "number") {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    const updatedLog = await TaskLog.findOneAndUpdate(
      { email, taskId },
      {
        $set: { task, taskType, description, lastUpdated: new Date() },
        $inc: { durationSeconds },
        $push: { timestamps: timestamp },
      },
      { new: true, upsert: true }
    );

    return NextResponse.json({ success: true, log: updatedLog }, { status: 200 });
  } catch (err) {
    console.error("Error in POST /api/task-log:", err);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function GET(req) {
  try {
    await connectToDatabase();
    const { searchParams } = new URL(req.url);

    const email = searchParams.get("user")?.toLowerCase();
    if (!email) {
      return NextResponse.json(
        { success: false, error: "Missing user email" },
        { status: 400 }
      );
    }

    const logs = await TaskLog.find({ email }).lean();

    return NextResponse.json(logs, { status: 200 });
  } catch (err) {
    console.error("Error in GET /api/task-log:", err);
    return NextResponse.json(
      { success: false, error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
