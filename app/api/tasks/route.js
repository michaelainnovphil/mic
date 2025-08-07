// app/api/tasks/route.js

import connectToDatabase from "@/lib/mongodb";
import Task from "@/lib/models/Task";

export async function GET() {
  await connectToDatabase();
  const tasks = await Task.find();
  return Response.json(tasks);
}

export async function POST(req) {
  await connectToDatabase();
  const { title, description } = await req.json();

  const newTask = new Task({ title, description, status: "pending" });
  await newTask.save();

  return Response.json(newTask);
}
