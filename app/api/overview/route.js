import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectToDatabase from "@/lib/mongodb";
import Task from "@/lib/models/Task";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  await connectToDatabase();

  // Group tasks by assignedTo user and count completed ones
  const stats = await Task.aggregate([
    { $match: { status: "completed" } },
    { $unwind: "$assignedTo" },
    {
      $group: {
        _id: "$assignedTo",
        completedTasks: { $sum: 1 },
      },
    },
  ]);

  return Response.json(stats);
}
