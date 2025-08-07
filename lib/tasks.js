// lib/tasks.js
import Task from "./models/Task";
import connectToDatabase from "./mongodb";

// Create a new task
export async function addTask({ title, description }) {
  await connectToDatabase();
  const task = new Task({
    title,
    description: description || "",
  });
  await task.save();
  return task;
}

// Get all tasks
export async function getAllTasks() {
  await connectToDatabase();
  return Task.find().sort({ createdAt: -1 });
}
