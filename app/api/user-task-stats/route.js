import connectToDatabase from "@/lib/mongodb";
import Task from "@/lib/models/Task";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    await connectToDatabase();

    const allTasks = await Task.find({}, "assignedTo status");

    const stats = {};

    for (const task of allTasks) {
      const email = task.assignedTo;
      const status = task.status?.toLowerCase().trim(); 

      if (!email) continue; 

      if (!stats[email]) {
        stats[email] = { completed: 0, pending: 0 };
      }

      if (status === "completed") {
        stats[email].completed += 1;
      } else {
        stats[email].pending += 1;
      }
    }
    console.log("Task Stats:", stats);

    return Response.json({ success: true, stats });
  } catch (error) {
    console.error("Error getting task stats:", error);
    return Response.json(
      { success: false, error: "Failed to get task stats." },
      { status: 500 }
    );
  }
}
