"use client";

import { useEffect, useRef, useState } from "react";
import Header from "@/components/Header";
import TaskTimerWidget from "@/components/TaskTimerWidget";
import * as XLSX from "xlsx";


const updateTaskStatus = async (taskId, status) => {
  await fetch(`/api/tasks/${taskId}/status`, {
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
  const [assignedTo, setAssignedTo] = useState("");
  const [users, setUsers] = useState([]);
  const [priority, setPriority] = useState("Medium");
  const [filter, setFilter] = useState("active"); // active | completed | all

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(Array.isArray(data.value) ? data.value : []);
  };

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

  useEffect(() => {
    const stored = localStorage.getItem("activeTask");
    if (stored) {
      const parsed = JSON.parse(stored);
      setActiveTask(parsed.task);
      setTaskType(parsed.taskType || "");
    }
  }, []);

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

    const filtered = data.filter((task) => {
      if (filter === "all") return true;
      if (filter === "completed") return task.status === "completed";
      return task.status === "pending" || task.status === "in-progress";
    });

    setTasks(filtered);
  };

  const handleAddTask = async () => {
    if (!title) return alert("Title is required");

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, assignedTo, priority }),
    });
    setAssignedTo("");

    if (res.ok) {
      setTitle("");
      setDescription("");
      setPriority("Medium");
      fetchTasks();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to add task");
    }
  };

  const handleStart = (task) => {
    localStorage.setItem("currentTask", JSON.stringify(task));
    window.dispatchEvent(new Event("storage"));
  };

  const startTask = async (task) => {
    const now = Date.now();
    const prev = previousTaskRef.current;

    if (task.status === "pending") {
      await updateTaskStatus(task._id, "in-progress");
    }

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
    setActiveTask(taskPayload);

    previousTaskRef.current = {
      task,
      taskType: current.taskType || "",
      startedAt: now,
    };
    await fetchTasks();
  };

  const stopTask = () => {
    const stored = JSON.parse(localStorage.getItem("activeTask"));
    if (stored?.task?._id) {
      updateTaskStatus(stored.task._id, "completed");
      setFilter("completed"); // ✅ Switch to completed filter
    }

    setActiveTask(null);
    setTaskType("");
    localStorage.removeItem("activeTask");
  };

  const exportLogsToExcel = () => {
    const data = taskLogsRef.current.map((log) => ({
      Task: log.title,
      Description: log.description,
      Type: log.type,
      "Time Spent (min)": (log.secondsSpent / 60).toFixed(2),
      "Started At": log.startedAt,
      "Ended At": log.endedAt,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Task Logs");

    XLSX.writeFile(workbook, "task_logs.xlsx");
  };


  return (
  <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
    <Header />
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-blue-900 dark:text-blue-300">Task Manager</h1>

      {/* Filter Controls */}
      <div className="flex gap-2 mb-6">
        {["active", "completed", "all"].map((key) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-full transition font-medium ${
              filter === key
                ? "bg-blue-900 text-white"
                : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {/* Add Task */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md mb-8 space-y-4">
        <h2 className="text-2xl font-semibold">Add a Task</h2>
        <input
          type="text"
          placeholder="Task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block mb-1 font-medium">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full border rounded-lg p-3 dark:bg-gray-700 dark:text-white dark:border-gray-600"
            >
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
            </select>
          </div>

          <div>
            <label className="block mb-1 font-medium">Assign to</label>
            <select
              name="assignedTo"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user.id || user._id} value={user.mail || user.email}>
                  {user.displayName || user.mail || user.email}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleAddTask}
          className="bg-blue-900 hover:bg-blue-800 text-white px-6 py-3 rounded-lg shadow-sm transition"
        >
          ➕ Add Task
        </button>
      </div>

      {/* Task List */}
      <div className="space-y-4">
        {tasks.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No tasks yet.</p>
        ) : (
          tasks.map((task, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow flex justify-between items-start gap-4"
            >
              <div className="flex-1 space-y-1">
                <h3 className="text-lg font-bold text-blue-900 dark:text-blue-300">{task.title}</h3>
                <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      task.status === "completed"
                        ? "bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100"
                        : task.status === "in-progress"
                        ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100"
                        : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {task.status}
                  </span>
                  {task.priority === "High" && <span className="text-red-500">❗ High Priority ❗</span>}
                </div>
                {task.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">{task.description}</p>
                )}
                {task.assignedTo && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Assigned to: <strong>{task.assignedTo}</strong>
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                {task.status === "in-progress" ? (
                  <>
                    <button
                      onClick={async () => {
                        await updateTaskStatus(task._id, "completed");
                        fetchTasks();
                        setActiveTask(null);
                        localStorage.removeItem("activeTask");
                      }}
                      className="bg-green-600 hover:bg-green-500 text-white px-4 py-1 rounded-lg transition"
                    >
                      Complete
                    </button>
                    <button
                      onClick={async () => {
                        await updateTaskStatus(task._id, "pending");
                        fetchTasks();
                        setActiveTask(null);
                        localStorage.removeItem("activeTask");
                      }}
                      className="bg-red-600 hover:bg-red-500 text-white px-4 py-1 rounded-lg transition"
                    >
                      Abandon
                    </button>
                  </>
                ) : task.status !== "completed" ? (
                  <button
                    onClick={() => startTask(task)}
                    className="bg-blue-900 hover:bg-blue-800 text-white px-4 py-1 rounded-lg transition"
                  >
                    Start
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>

    {/* Timer widget if active */}
    <TaskTimerWidget activeTask={activeTask} />
  </div>
);

}
