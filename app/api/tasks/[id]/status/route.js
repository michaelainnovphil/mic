// app/api/tasks/[id]/status/route.js

import connectToDatabase from "@/lib/mongodb";
import Task from "@/lib/models/Task";

export async function PUT(req, context) {
  const { params } = context; // Access params INSIDE the function
  const { id } = params;      // Destructure id here
  const { status } = await req.json();

  await connectToDatabase();

  try {
    const task = await Task.findByIdAndUpdate(id, { status }, { new: true });
    if (!task) return new Response("Task not found", { status: 404 });

    return Response.json(task);
  } catch (error) {
    console.error("Task status update failed:", error);
    return new Response("Failed to update task", { status: 500 });
  }
}
