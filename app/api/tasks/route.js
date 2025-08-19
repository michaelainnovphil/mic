// app/api/tasks/[id]/route.js

import { getServerSession } from "next-auth";
import connectToDatabase from "@/lib/mongodb";
import { authOptions } from "@/lib/authOptions";
import Task from "@/lib/models/Task";

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  await connectToDatabase();

  // Parse query params
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // ?status=completed

  // ✅ Always filter by logged-in user
  let filter = { assignedTo: session.user.email };
  if (status) filter.status = status;

  const tasks = await Task.find(filter);
  return Response.json(tasks);
}
