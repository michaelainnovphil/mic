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

  // Only return tasks assigned to the logged-in user
  const tasks = await Task.find({ assignedTo: session.user.email });
  return Response.json(tasks);
}

export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  await connectToDatabase();
  const { title, description, assignedTo, priority } = await req.json();

  // If assignedTo is not specified, assign to the current user
  const newTask = new Task({
    title,
    description,
    assignedTo: assignedTo || session.user.email,
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
