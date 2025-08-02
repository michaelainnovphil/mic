// app/api/task/route.js

import { addTask, getAllTasks } from "@/lib/tasks";

export async function POST(req) {
  const body = await req.json();
  const { title, description } = body;

  if (!title) {
    return new Response(JSON.stringify({ error: "Title is required" }), {
      status: 400,
    });
  }

  const task = addTask({ title, description });
  return new Response(JSON.stringify({ message: "Task added", task }), {
    status: 201,
  });
}

export async function GET() {
  const tasks = getAllTasks();
  return new Response(JSON.stringify({ tasks }), {
    status: 200,
  });
}
