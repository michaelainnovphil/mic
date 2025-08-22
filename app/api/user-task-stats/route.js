// app/api/user-task-stats/route.js

import connectToDatabase from "@/lib/mongodb";
import TaskLog from "@/lib/models/TaskLog"; 

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectToDatabase();

    // Aggregate logs per user
    const logs = await TaskLog.aggregate([
      {
        $group: {
          _id: "$email",
          totalDuration: { $sum: "$duration" },
          logs: { $push: "$$ROOT" },
        },
      },
    ]);

    const stats = {};
    logs.forEach((entry) => {
      stats[entry._id] = {
        totalDuration: entry.totalDuration || 0,
      };
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
