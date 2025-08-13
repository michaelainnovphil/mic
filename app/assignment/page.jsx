"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import TaskTimerWidget from "@/components/TaskTimerWidget";

export default function AssignmentPage() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [assignedTo, setAssignedTo] = useState("");

  useEffect(() => {
    fetchTeamMembers();
    fetchAssignedTasks();
    fetchTeamTasks();
  }, []);

  const fetchTeamMembers = async () => {
    const res = await fetch("/api/users"); // Replace with API to fetch team members
    const data = await res.json();
    setTeamMembers(Array.isArray(data.value) ? data.value : []);
  };

  const fetchAssignedTasks = async () => {
    const res = await fetch("/api/tasks?assignedByMe=true"); // Tasks added by current user
    const data = await res.json();
    setAssignedTasks(data || []);
  };

  const fetchTeamTasks = async () => {
    const res = await fetch("/api/tasks?teamTasks=true"); // Tasks from team members
    const data = await res.json();
    setTeamTasks(data || []);
  };

  const handleAddTask = async () => {
    if (!title) return alert("Title is required");

    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, priority, assignedTo }),
    });

    if (res.ok) {
      setTitle("");
      setDescription("");
      setPriority("Medium");
      setAssignedTo("");
      fetchAssignedTasks();
    } else {
      const data = await res.json();
      alert(data.error || "Failed to add task");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <Header />

      <div className="p-6 max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-blue-900 dark:text-blue-300">Assignment</h1>

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
            <h2 className="text-xl font-semibold mb-4">Assigned tasks to the team</h2>
            <div className="space-y-4">
              {assignedTasks.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No tasks assigned yet.</p>
              ) : (
                assignedTasks.map((task) => (
                  <div key={task._id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                    <h3 className="font-bold">{task.title}</h3>
                    {task.description && <p className="text-sm">{task.description}</p>}
                    <p className="text-sm text-gray-500">Priority: {task.priority}</p>
                    {task.assignedTo && <p className="text-sm">Assigned to: {task.assignedTo}</p>}
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Team Overview</h2>
            <div className="space-y-4">
                
              {teamTasks.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No team tasks yet.</p>
              ) : (
                teamTasks.map((task) => (
                  <div key={task._id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                    <h3 className="font-bold">{task.title}</h3>
                    {task.description && <p className="text-sm">{task.description}</p>}
                    <p className="text-sm text-gray-500">Priority: {task.priority}</p>
                    <p className="text-sm">Assigned by: {task.createdBy || "N/A"}</p>
                  </div>
                ))
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
