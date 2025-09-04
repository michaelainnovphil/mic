// app/api/user-task-stats/route.js

import connectToDatabase from "@/lib/mongodb";
import Task from "@/lib/models/Task";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();

    // Pull only the fields we need
    const tasks = await Task.find({}, "assignedTo status duration").lean();

    const stats = {};

    const addForEmail = (email, task) => {
      if (!email) return;
      const key = String(email).toLowerCase().trim();
      if (!stats[key]) {
        stats[key] = { totalDuration: 0, completed: 0, pending: 0 };
      }

      // Task.duration is stored in SECONDS; convert to HOURS for the dashboard
      const durationSeconds = Number(task.duration) || 0;
      stats[key].totalDuration += durationSeconds / 3600;

      if (task.status === "completed") stats[key].completed += 1;
      if (task.status === "pending" || task.status === "in-progress")
        stats[key].pending += 1;
    };

    for (const task of tasks) {
      if (Array.isArray(task.assignedTo) && task.assignedTo.length) {
        task.assignedTo.forEach((e) => addForEmail(e, task));
      } else if (typeof task.assignedTo === "string") {
        addForEmail(task.assignedTo, task);
      }
    }

    return new Response(JSON.stringify({ success: true, stats }), {
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
  