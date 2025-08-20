import { getServerSession } from "next-auth";
import connectToDatabase from "@/lib/mongodb";
import { authOptions } from "@/lib/authOptions";
import Task from "@/lib/models/Task";

// GET tasks (optionally filtered by ?status=)
export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  await connectToDatabase();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  let filter = {};
  if (status) filter.status = status;

  const tasks = await Task.find(filter);
  return new Response(JSON.stringify(tasks), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Create a new task
export async function POST(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  await connectToDatabase();
  const { title, description, assignedTo, priority } = await req.json();

  const newTask = new Task({
    title,
    description,
    assignedTo: assignedTo ? (Array.isArray(assignedTo) ? assignedTo : [assignedTo]) : [],
    status: "pending",
    priority: priority || "Medium",
  });

  await newTask.save();

  return new Response(JSON.stringify(newTask), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Update task by ID
export async function PATCH(req, { params }) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  await connectToDatabase();

  const { id } = params; // comes from /api/tasks/[id]
  if (!id) {
    return new Response(JSON.stringify({ error: "Missing task ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await req.json();

  const taskUpdates = {};
  if (body.assignedTo) taskUpdates.assignedTo = Array.isArray(body.assignedTo) ? body.assignedTo : [body.assignedTo];
  if (body.status) taskUpdates.status = body.status;
  if (body.title) taskUpdates.title = body.title;
  if (body.description) taskUpdates.description = body.description;
  if (body.priority) taskUpdates.priority = body.priority;

  if (Object.keys(taskUpdates).length === 0) {
    return new Response(JSON.stringify({ error: "No updates provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const updatedTask = await Task.findByIdAndUpdate(id, taskUpdates, { new: true });

  if (!updatedTask) {
    return new Response(JSON.stringify({ error: "Task not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify(updatedTask), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
