"use client";

import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import TaskTimerWidget from "@/components/TaskTimerWidget";
import * as XLSX from "xlsx"; // ✅ Needed for export

const TASK_TYPES = [
  "Team Huddle",
  "Adhoc",
  "Coffee Break",
  "Lunch Break",
  "Meeting",
  "Productivity Hours",
];

const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const updateTaskStatus = async (taskId, status) => {
  await fetch(`/api/task/${taskId}/status`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
};

export default function TasksPage() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activeTask, setActiveTask] = useState(null);
  const [taskType, setTaskType] = useState("");
  const [timeLeft, setTimeLeft] = useState(9 * 60 * 60); // 9 hours
  const previousTaskRef = useRef(null);
  const taskLogsRef = useRef([]);
  const widgetRef = useRef(null);

  // Fetch all tasks
  useEffect(() => {
    fetchTasks();
  }, []);

  // Timer countdown
  useEffect(() => {
    const startAt = localStorage.getItem("timerStartAt");
    if (startAt) {
      const elapsed = Math.floor((Date.now() - parseInt(startAt)) / 1000);
      const remaining = Math.max(0, 9 * 60 * 60 - elapsed);
      setTimeLeft(remaining);
    }

    const interval = setInterval(() => {
      const startAt = localStorage.getItem("timerStartAt");
      if (startAt) {
        const elapsed = Math.floor((Date.now() - parseInt(startAt)) / 1000);
        const remaining = Math.max(0, 9 * 60 * 60 - elapsed);
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Load active task from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("activeTask");
    if (stored) {
      const parsed = JSON.parse(stored);
      setActiveTask(parsed.task);
      setTaskType(parsed.taskType || "");
    }
  }, []);

  // ✅ Auto export at 5:30 PM
  useEffect(() => {
    const now = new Date();
    const msUntilEndOfDay =
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 30, 0) - now;

    if (msUntilEndOfDay > 0) {
      const timeout = setTimeout(() => {
        exportLogsToExcel();
      }, msUntilEndOfDay);
      return () => clearTimeout(timeout);
    }
  }, []);

  const fetchTasks = async () => {
  const res = await fetch("/api/tasks");
  const data = await res.json();
  console.log("Fetched tasks:", data); // ✅ Debug log
  setTasks(Array.isArray(data) ? data : []);
};


  const handleAddTask = async () => {
    if (!title) return alert("Title is required");

    const res = await fetch("/api/tasks", {
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

  const handleStart = (task) => {
  localStorage.setItem("currentTask", JSON.stringify(task));
  window.dispatchEvent(new Event("storage")); // manually trigger storage event
};


  const startTask = (task) => {
  const now = Date.now();
  const prev = previousTaskRef.current;
  updateTaskStatus(task._id, "pending");


  if (prev && prev.task && prev.startedAt) {
    const secondsSpent = Math.floor((now - prev.startedAt) / 1000);
    taskLogsRef.current.push({
      title: prev.task.title,
      type: prev.taskType || "",
      secondsSpent,
      startedAt: new Date(prev.startedAt).toLocaleTimeString(),
      endedAt: new Date(now).toLocaleTimeString(),
    });
  }

  if (!localStorage.getItem("timerStartAt")) {
    localStorage.setItem("timerStartAt", now.toString());
  }

  const current = JSON.parse(localStorage.getItem("activeTask")) || {};
  const taskPayload = { task, taskType: current.taskType || "" };

  localStorage.setItem("activeTask", JSON.stringify(taskPayload));
  setActiveTask(taskPayload); // ✅ This ensures TaskTimerWidget receives the correct shape

  previousTaskRef.current = {
    task,
    taskType: current.taskType || "",
    startedAt: now,
  };
};


  const stopTask = () => {
  const stored = JSON.parse(localStorage.getItem("activeTask"));
  if (stored?.task?._id) {
    updateTaskStatus(stored.task._id, "completed");
  }

  setActiveTask(null);
  setTaskType("");
  localStorage.removeItem("activeTask");
};


  // ✅ Manual export button support
  const exportLogsToExcel = () => {
    const data = taskLogsRef.current.map((log) => ({
      Task: log.title,
      Type: log.type,
      "Time Spent (min)": (log.secondsSpent / 60).toFixed(2),
      "Started At": log.startedAt,
      "Ended At": log.endedAt,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Task Logs");

    XLSX.writeFile(wb, `task_logs_${new Date().toLocaleDateString()}.xlsx`);
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
                  <p>Status: {task.status}</p>

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

      {/* ✅ Timer widget appears based on activeTask */}
      <TaskTimerWidget activeTask={activeTask} />
    </div>
  );
}
