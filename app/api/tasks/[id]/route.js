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
  const task = await Task.findById(id);
  if (!task) {
    return new Response(JSON.stringify({ error: "Task not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const taskUpdates = {};
  if (body.assignedTo)
    taskUpdates.assignedTo = Array.isArray(body.assignedTo)
      ? body.assignedTo
      : [body.assignedTo];
  if (body.status) taskUpdates.status = body.status;
  if (body.title) taskUpdates.title = body.title;
  if (body.description) taskUpdates.description = body.description;
  if (body.priority) taskUpdates.priority = body.priority;

  // --- handle start/resume/stop logic ---
  if (body.status) {
    if (body.status === "in-progress") {
      // mark a fresh start time
      taskUpdates.startTime = new Date();
    }

    if (body.status === "completed" || body.status === "stopped") {
      taskUpdates.endTime = new Date();

      if (task.startTime) {
        const durationMs =
          new Date(taskUpdates.endTime) - new Date(task.startTime);

        const durationSeconds = Math.floor(durationMs / 1000);

        // accumulate total duration
        taskUpdates.duration =
          (task.duration || 0) + durationSeconds;

        // clear startTime so next resume starts fresh
        taskUpdates.startTime = null;
      }
    }
  }

  if (Object.keys(taskUpdates).length === 0) {
    return new Response(JSON.stringify({ error: "No updates provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const updatedTask = await Task.findByIdAndUpdate(id, taskUpdates, {
    new: true,
  });

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
    return new Response("Unauthorized", { status: 401 });
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
