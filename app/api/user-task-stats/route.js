// app/api/user-task-stats/route.js

import connectToDatabase from "@/lib/mongodb";
import Task from "@/lib/models/Task";
import TaskLog from "@/lib/models/TaskLog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();

    const stats = {};

    // --- 1. Aggregate TaskLogs ---
    const logs = await TaskLog.aggregate([
      {
        $group: {
          _id: "$email",
          totalDurationSeconds: { $sum: "$durationSeconds" },
        },
      },
    ]);

    logs.forEach((entry) => {
      stats[entry._id] = {
        totalDuration: (entry.totalDurationSeconds || 0) / 3600, // convert to hours
        completed: 0,
        pending: 0,
      };
    });

    // --- 2. Aggregate Tasks directly ---
    const tasks = await Task.find();

    tasks.forEach((task) => {
      if (!task.assignedTo || task.assignedTo.length === 0) return;

      task.assignedTo.forEach((email) => {
        const normalizedEmail = email.toLowerCase().trim();

        if (!stats[normalizedEmail]) {
          stats[normalizedEmail] = { totalDuration: 0, completed: 0, pending: 0 };
        }

        // add duration (stored in Task model)
        stats[normalizedEmail].totalDuration += task.duration || 0;

        // track status counts
        if (task.status === "completed") stats[normalizedEmail].completed++;
        if (task.status === "pending" || task.status === "in-progress")
          stats[normalizedEmail].pending++;
      });
    });

    return Response.json({ success: true, stats });
  } catch (error) {
    console.error("Error getting user task stats:", error);
    return Response.json(
      { success: false, error: "Failed to get user task stats." },
      { status: 500 }
    );
  }
}
