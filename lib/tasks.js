// lib/tasks.js
let tasks = [];

export function addTask({ title, description }) {
  const task = {
    id: Date.now(),
    title,
    description: description || "",
  };
  tasks.push(task);
  return task;
}

export function getAllTasks() {
  return tasks;
}
