// app/api/user-task-stats/route.js

import connectToDatabase from "@/lib/mongodb";
import TaskLog from "@/lib/models/TaskLog";
import Task from "@/lib/models/Task";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();

    // --- 1) TaskLogs: get worked durations ---
    const logs = await TaskLog.find({}, "email durationSeconds").lean();

    const logStats = {};
    logs.forEach((log) => {
      const email = log.email?.toLowerCase().trim();
      if (!email) return;

      if (!logStats[email]) {
        logStats[email] = { durationSeconds: 0 };
      }

      logStats[email].durationSeconds += Number(log.durationSeconds) || 0;
    });

    // --- 2) Tasks: get counts (completed/pending) ---
    const tasks = await Task.find({}, "assignedTo status").lean();
    const taskStats = {};

    const addForEmail = (email, task) => {
      const key = String(email).toLowerCase().trim();
      if (!taskStats[key]) {
        taskStats[key] = { completed: 0, pending: 0 };
      }
      if (task.status === "completed") taskStats[key].completed += 1;
      if (task.status === "pending" || task.status === "in-progress") {
        taskStats[key].pending += 1;
      }
    };

    tasks.forEach((task) => {
      if (Array.isArray(task.assignedTo)) {
        task.assignedTo.forEach((e) => addForEmail(e, task));
      } else if (typeof task.assignedTo === "string") {
        addForEmail(task.assignedTo, task);
      }
    });

    // --- 3) Merge both sources ---
    const finalStats = {};
    const allUsers = new Set([
      ...Object.keys(logStats),
      ...Object.keys(taskStats),
    ]);

    allUsers.forEach((email) => {
      const seconds = logStats[email]?.durationSeconds || 0;

      finalStats[email] = {
        durationSeconds: seconds,
        totalDuration: seconds / 3600, // ✅ convert to hours
        completed: taskStats[email]?.completed || 0,
        pending: taskStats[email]?.pending || 0,
      };
    });

    return new Response(JSON.stringify({ success: true, stats: finalStats }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error getting user task stats:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Failed to get user task stats.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
