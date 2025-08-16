// app/api/tasks/route.js or app/api/tasks/[id]/route.js

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

  // ✅ Fetch ALL tasks, regardless of assignedTo
  const tasks = await Task.find({});
  return Response.json(tasks);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  await connectToDatabase();
  const { title, description, assignedTo, priority } = await req.json();

  // ✅ Do not set assignedTo unless provided
  const newTask = new Task({
    title,
    description,
    assignedTo: assignedTo || null, // Null if not provided
    status: "pending",
    priority: priority || "Medium",
  });

  await newTask.save();

  return Response.json(newTask);
}

export async function PATCH(req) {
  await connectToDatabase();
  const { id, status, updates } = await req.json();

  const taskUpdates = updates || (status ? { status } : null);

  if (!id || !taskUpdates) {
    return Response.json({ error: "Missing ID or updates" }, { status: 400 });
  }

  const updatedTask = await Task.findByIdAndUpdate(id, taskUpdates, {
    new: true,
  });

  if (!updatedTask) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  return Response.json(updatedTask);
}
