// app/api/overview/top-performers/route.js

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import connectToDatabase from "@/lib/mongodb";
import Task from "@/lib/models/Task";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  await connectToDatabase();

  // Group completed tasks per user
  const performers = await Task.aggregate([
    { $match: { status: "completed" } },
    { $unwind: "$assignedTo" },
    {
      $group: {
        _id: "$assignedTo", // could be user email/id
        completedTasks: { $sum: 1 },
      },
    },
    { $sort: { completedTasks: -1 } }, // rank top performers
    { $limit: 10 }, // top 10
  ]);

  return Response.json(performers);
}
