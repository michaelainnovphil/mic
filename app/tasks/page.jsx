"use client";

import { useEffect, useRef, useState } from "react";
import { SessionProvider, useSession } from "next-auth/react";
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

function TasksContent() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activeTask, setActiveTask] = useState(null);
  const [taskType, setTaskType] = useState("");
  const [timeLeft, setTimeLeft] = useState(9 * 60 * 60); // 9 hours
  const previousTaskRef = useRef(null);
  const taskLogsRef = useRef([]);
  const [assignedTo, setAssignedTo] = useState("");
  const [users, setUsers] = useState([]);
  const [priority, setPriority] = useState("Medium");
  const [filter, setFilter] = useState("active"); // active | completed | all
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data: session } = useSession();
  const [unassignedTasks, setUnassignedTasks] = useState([]);

  useEffect(() => {
    fetchTasks();
  }, [filter, session?.user?.email]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    setUsers(Array.isArray(data.value) ? data.value : []);
  };

  

  const fetchTasks = async () => {
  const res = await fetch("/api/tasks");
  const data = await res.json();
  

  const filtered = data.filter((task) => {
    if (filter === "all") return true;
    if (filter === "completed") return task.status === "completed";
    return task.status === "pending" || task.status === "in-progress";
  });

  // current user tasks only
  const myEmail = session?.user?.email?.toLowerCase();
  const mine = filtered.filter((task) => {
    if (!task.assignedTo) return false;
    if (Array.isArray(task.assignedTo)) {
      return task.assignedTo.some((a) => a?.toLowerCase() === myEmail);
    }
    return task.assignedTo?.toLowerCase() === myEmail;
  });

  setTasks(mine);

  // unassigned tasks
  const unassigned = filtered.filter((task) => {
    if (!task.assignedTo) return true;

    if (Array.isArray(task.assignedTo)) {
      return (
      task.assignedTo.length === 0 ||
      task.assignedTo.every(
        (a) => !a || a.toLowerCase().trim() === "unassigned"
      )
    );
  }

  const val = task.assignedTo.toString().trim().toLowerCase();
  return val === "" || val === "unassigned";
});

  
  setUnassignedTasks(unassigned);
};

      

  const handleAddTask = async () => {
    if (!title) return alert("Title is required");

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, assignedTo, priority }),
    });

    if (res.ok) {
      setTitle("");
      setDescription("");
      setPriority("Medium");
      setAssignedTo("");
      fetchTasks();
      setDrawerOpen(false);
    } else {
      const data = await res.json();
      alert(data.error || "Failed to add task");
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      {/* Drawer */}
      <div
        className={`h-screen bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 flex flex-col ${
          drawerOpen ? "w-80" : "w-16"
        }`}
      >
        {/* Toggle Button */}
        <div className="flex justify-end p-2">
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="text-gray-600 dark:text-gray-300"
          >
            {drawerOpen ? "←" : "→"}
          </button>
        </div>

        {/* Drawer Content */}
{drawerOpen && (
  <div className="p-4 flex-1 overflow-y-auto">
    <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-4">
      Unassigned Tasks
    </h2>
    {unassignedTasks.length > 0 ? (
      <ul className="space-y-3">
        {unassignedTasks.map((task) => (
          <li
            key={task._id}
            className="p-3 border rounded-lg shadow-sm bg-gray-50 dark:bg-gray-700"
          >
            <div className="font-medium">{task.title}</div>
            {task.description && (
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {task.description}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-1">
              Priority: {task.priority}
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-gray-500 dark:text-gray-400">
        No unassigned tasks.
      </p>
    )}
  </div>
)}

         
      </div>

      {/* Main Content */}
      <div className="flex-1">
        <Header />
        <div className="p-6 max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-blue-900 dark:text-blue-300">
            My Tasks
          </h1>

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

          {/* Task List */}
          <div className="space-y-4">
            {tasks.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No tasks yet.</p>
            ) : (
              tasks.map((task) => (
                <div
                  key={task._id}
                  className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow flex justify-between items-start gap-4"
                >
                  <div className="flex-1 space-y-1">
                    <h3 className="text-lg font-bold text-blue-900 dark:text-blue-300">
                      {task.title}
                    </h3>
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
                      {task.priority === "High" && (
                        <span className="text-red-500">❗ High Priority ❗</span>
                      )}
                    </div>
                    {task.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        {task.description}
                      </p>
                    )}
                    {task.assignedTo && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Assigned to: <strong>{task.assignedTo}</strong>
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Timer widget if active */}
        <TaskTimerWidget activeTask={activeTask} />
      </div>
    </div>
  );
}

export default function TasksPage() {
  return (
    <SessionProvider>
      <TasksContent />
    </SessionProvider>
  );
}
