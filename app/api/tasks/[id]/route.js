// app/api/tasks/[id]/route.js

import { getServerSession } from "next-auth";
import connectToDatabase from "@/lib/mongodb";
import { authOptions } from "@/lib/authOptions";
import Task from "@/lib/models/Task";

// Update task by ID
export async function PATCH(req, context) {
  const { params } = await context; 
  const { id } = params;

  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new Response("Unauthorized", { status: 401 });
  }

  await connectToDatabase();

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

// Delete task by ID
export async function DELETE(req, context) {
  const { params } = await context; 
  const { id } = params;

  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  await connectToDatabase();

  if (!id) {
    return new Response(JSON.stringify({ error: "Missing task ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const deletedTask = await Task.findByIdAndDelete(id);

  if (!deletedTask) {
    return new Response(JSON.stringify({ error: "Task not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true, id }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
