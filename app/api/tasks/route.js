// app/api/tasks/route.js
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import Task from "@/lib/models/Task";
import { TEAM_MAP } from "@/lib/teamMap";
import connectToDatabase from "@/lib/mongodb";

// GET tasks (optionally filtered by ?status=workbasket)
export async function GET(req) {
  await connectToDatabase();
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const userEmail = session.user.email;
  const userTeam = TEAM_MAP[userEmail] || null;

  if (!userTeam) {
    return Response.json([]);
  }

  // Find all members of the user's team
  const teamMembers = Object.keys(TEAM_MAP).filter(
    (email) => TEAM_MAP[email] === userTeam
  );

  let query = {};

  if (status === "workbasket") {
    // Only show unassigned tasks created by the user's team
    query = {
      assignedTo: { $size: 0 },
      createdBy: { $in: teamMembers },
    };
  }

  const tasks = await Task.find(query).sort({ createdAt: -1 });
  return Response.json(tasks);
}

// POST new task
export async function POST(req) {
  await connectToDatabase();
  const session = await getServerSession(authOptions);

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const data = await req.json();
  const task = new Task({
    ...data,
    createdBy: session.user.email,
  });

  await task.save();
  return Response.json(task);
}
