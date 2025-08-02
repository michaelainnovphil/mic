"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";

const TASK_TYPES = [
  "Team Huddle",
  "Adhoc",
  "Coffee Break",
  "Lunch Break",
  "Meeting",
];

const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activeTask, setActiveTask] = useState(null);
  const [taskType, setTaskType] = useState("");
  const [timeLeft, setTimeLeft] = useState(9 * 60 * 60); // 9 hours

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    let timer;
    if (activeTask && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeTask, timeLeft]);

  const fetchTasks = async () => {
    const res = await fetch("/api/task");
    const data = await res.json();
    setTasks(data.tasks || []);
  };

  const handleAddTask = async () => {
    if (!title) return alert("Title is required");

    const res = await fetch("/api/task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  const startTask = (task) => {
    setActiveTask(task);
    setTaskType("");
    setTimeLeft(9 * 60 * 60);
  };

  const stopTask = () => {
    setActiveTask(null);
    setTaskType("");
    setTimeLeft(9 * 60 * 60);
  };

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
                className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow flex justify-between items-center"
              >
                <div>
                  <h3 className="text-lg font-bold">{task.title}</h3>
                  {task.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      {task.description}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => startTask(task)}
                  className="bg-green-600 hover:bg-green-500 text-white px-4 py-1 rounded"
                >
                  Start
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Floating Widget */}
      {activeTask && (
        <div className="fixed bottom-6 right-6 w-80 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow-2xl rounded-xl p-4 z-50">
          <div className="text-sm text-gray-700 dark:text-gray-200 mb-2">
            <strong>Task:</strong> {activeTask.title}
          </div>

          <select
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            className="w-full mb-2 p-2 rounded border dark:bg-gray-700 dark:text-white"
          >
            <option value="">-- Select Type --</option>
            {TASK_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <div className="text-2xl font-mono text-center mb-2">
            ⏳ {formatTime(timeLeft)}
          </div>

          <button
            onClick={stopTask}
            className="w-full bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded"
          >
            Stop
          </button>
        </div>
      )}
    </div>
  );
}
