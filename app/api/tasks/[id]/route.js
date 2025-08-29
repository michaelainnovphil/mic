import { NextResponse } from "next/server";
import { updateTask } from "@/lib/tasks";

export async function PATCH(req, context) {
  try {
    const { id } = await context.params;
    const body = await req.json();

    const updatedTask = await updateTask(id, body);

    if (!updatedTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(updatedTask, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}
