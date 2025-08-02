"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const fetchTasks = async () => {
    const res = await fetch("/api/task");
    const data = await res.json();
    setTasks(data.tasks || []);
  };

  const handleAddTask = async () => {
    if (!title) return alert("Title is required");

    const res = await fetch("/api/task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title, description }),
    });

    if (res.ok) {
      setTitle("");
      setDescription("");
      fetchTasks();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to add task");
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
              <Header />
    <div className="p-6 max-w-3xl mx-auto">
        
      <h1 className="text-3xl font-bold mb-6">Task Manager</h1>

      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md mb-6">
        <h2 className="text-xl font-semibold mb-2">Add a Task</h2>
        <input
          type="text"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full mb-2 p-2 rounded border dark:bg-gray-700 dark:text-white"
        />
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full mb-3 p-2 rounded border dark:bg-gray-700 dark:text-white"
        />
        <button
          onClick={handleAddTask}
          className="bg-blue-900 hover:bg-blue-800 text-white px-4 py-2 rounded"
        >
          Add Task
        </button>
      </div>

      <div className="space-y-4">
        {tasks.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No tasks yet.</p>
        ) : (
          tasks.map((task, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow"
            >
              <h3 className="text-lg font-bold">{task.title}</h3>
              {task.description && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  {task.description}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
    </div>
  );
}
