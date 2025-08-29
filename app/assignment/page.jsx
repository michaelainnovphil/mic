"use client";

import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import TaskTimerWidget from "@/components/TaskTimerWidget";

function AssignmentContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const currentUserEmail = session?.user?.email || "";
  const [refreshKey, setRefreshKey] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [assignedTo, setAssignedTo] = useState("");

  // Restrict access to assignment page
  useEffect(() => {
    if (status === "loading") return;

    const allowedUsers = [
      "mdbarreda@innovphil.com",
      "aarce@innovphil.com",
      "carce@innovphil.com",
      "amlinguete@innovphil.com",
      "mcastilla@innovphil.com",
    ];
    if (!session || !allowedUsers.includes(session.user.email)) {
      router.replace("/unauthorized");
    }
  }, [session, status, router]);

  useEffect(() => {
    if (currentUserEmail) {
      fetchTeamMembers();
      fetchAssignedTasks();
      fetchTeamTasks();
    }
  }, [currentUserEmail, refreshKey]);

  const fetchTeamMembers = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    setTeamMembers(Array.isArray(data.value) ? data.value : []);
  };

  const fetchAssignedTasks = async () => {
    const res = await fetch("/api/tasks");
    const data = await res.json();

    const allowedUsers = [
      "mdbarreda@innovphil.com",
      "aarce@innovphil.com",
      "carce@innovphil.com",
      "amlinguete@innovphil.com",
      "mcastilla@innovphil.com",
    ];
    if (allowedUsers.includes(currentUserEmail)) {
      const unassigned = (data || []).filter(
        (task) =>
          Array.isArray(task.assignedTo) &&
          (task.assignedTo.length === 0 || task.assignedTo.includes("unassigned"))
      );
      setAssignedTasks(unassigned);
    } else {
      const managerTasks = (data || []).filter(
        (task) => task.createdBy && task.createdBy !== currentUserEmail
      );
      setAssignedTasks(managerTasks);
    }
  };

  const fetchTeamTasks = async () => {
    const res = await fetch("/api/tasks");
    const data = await res.json();

    const userStats = {};
    (data || []).forEach((task) => {
      if (Array.isArray(task.assignedTo) && task.assignedTo.length > 0) {
        task.assignedTo.forEach((user) => {
          if (!user || user.toLowerCase() === "unassigned") return;

          if (!userStats[user]) {
            userStats[user] = { total: 0, completed: 0 };
          }
          userStats[user].total += 1;
          if (task.status === "completed") {
            userStats[user].completed += 1;
          }
        });
      }
    });

    setTeamTasks(userStats);
  };

  const handleAddTask = async () => {
    if (!title) return alert("Title is required");

    const assignedValue = assignedTo.trim() === "" ? "unassigned" : assignedTo;

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        priority,
        assignedTo: assignedValue,
        createdBy: currentUserEmail,
      }),
    });

    if (res.ok) {
      setTitle("");
      setDescription("");
      setPriority("Medium");
      setAssignedTo("");
      await fetchAssignedTasks();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to add task");
    }
  };

  //  Delete Task
  const handleDeleteTask = async (id) => {
    if (!confirm("Are you sure you want to delete this task?")) return;

    const res = await fetch(`/api/tasks/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      await fetchAssignedTasks();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to delete task");
    }
  };

  if (status === "loading") return <p>Loading...</p>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <Header />

      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-blue-900 dark:text-blue-300">
          Assignment
        </h1>

        {/* Add Task */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-md mb-8 space-y-4">
          <h2 className="text-2xl font-semibold">Add a Task</h2>
          <input
            type="text"
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
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
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              >
                <option value="">Select team member</option>
                {teamMembers.map((user) => (
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

        {/* Task Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Workbasket</h2>
            <div className="space-y-4">
              {assignedTasks.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">
                  No tasks assigned yet.
                </p>
              ) : (
                assignedTasks.map((task) => (
                  <div
                  key={task._id}
                  className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-2"
                >
                  {/* Header row with title and delete button */}
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold">{task.title}</h3>

                    <button
                      onClick={() => handleDeleteTask(task._id)}
                      className="bg-red-600 hover:bg-red-500 text-white text-sm px-3 py-1 rounded"
                    >
                      🗑 Delete
                    </button>
                  </div>

                  {task.description && <p className="text-sm">{task.description}</p>}
                  <p className="text-sm text-gray-500">Priority: {task.priority}</p>
                  {task.assignedTo && (
                    <p className="text-sm">Assigned to: {task.assignedTo}</p>
                  )}
                </div>

                ))
              )}
            </div>
          </div>

          {/* Team Overview */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Team Overview</h2>
            <div className="space-y-4">
              {Object.keys(teamTasks).length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">
                  No team tasks yet.
                </p>
              ) : (
                Object.entries(teamTasks).map(([user, stats]) => {
                  const percent =
                    stats.total > 0
                      ? Math.round((stats.completed / stats.total) * 100)
                      : 0;
                  return (
                    <div
                      key={user}
                      className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-2"
                    >
                      <h3 className="font-bold">{user}</h3>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                        <div
                          className="bg-blue-600 h-4 transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-500">
                        {stats.completed} / {stats.total} tasks completed ({percent}
                        %)
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Timer widget */}
      <TaskTimerWidget />
    </div>
  );
}

export default function AssignmentPage() {
  return (
    <SessionProvider>
      <AssignmentContent />
    </SessionProvider>
  );
}
