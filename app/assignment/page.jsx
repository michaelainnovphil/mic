"use client";

import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { Dialog } from "@headlessui/react";
import TaskTimerWidget from "@/components/TaskTimerWidget";
import { TEAM_MAP } from "@/lib/teamMap";




function formatDuration(seconds) {
  if (!seconds || seconds < 1) return "0m";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [
    h > 0 ? `${h}h` : "",
    m > 0 ? `${m}m` : "",
    s > 0 && h === 0 ? `${s}s` : "",
  ]
    .filter(Boolean)
    .join(" ");
}


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
  const [assignedTo, setAssignedTo] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userTasks, setUserTasks] = useState({ completed: [], inProgress: [], pending: [] });
  const [modalPeriod, setModalPeriod] = useState("daily");
  const [modalDate, setModalDate] = useState(new Date());
  const [teamView, setTeamView] = useState("all"); 
  const [taskDurations, setTaskDurations] = useState({});
  const [deleteMode, setDeleteMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
const [taskToDelete, setTaskToDelete] = useState(null);




  // Restrict
  useEffect(() => {
    if (status === "loading") return;

    const allowedUsers = [
      "mdbarreda@innovphil.com",
      "aarce@innovphil.com",
      "carce@innovphil.com",
      "amlinguete@innovphil.com",
      "mcastilla@innovphil.com",
      "mjpanotes@innovphil.com",
      "mgpajarillo@innovphil.com",
      "jabayon@innovphil.com",
      "jksanjose@innovphil.com",
      "apanotes@innovphil.com",
      "vgarcia@innovphil.com",
      "mltperez@innovphil.com",
      "vantoc@innovphil.com",
      "mclladones@innovphil.com",
    ];
    if (!session || !allowedUsers.includes(session.user.email)) {
      router.replace("/unauthorized");
    }
  }, [session, status, router]);

  useEffect(() => {
    if (currentUserEmail) {
      fetchTeamMembers();
      fetchTasksData();
    }
  }, [currentUserEmail, refreshKey]);

  const fetchTeamMembers = async () => {
    const res = await fetch("/api/users");
    const data = await res.json();
    setTeamMembers(Array.isArray(data.value) ? data.value : []);
  };

  const fetchTasksData = async () => {
    try {
      const [allTasksRes, teamTasksRes] = await Promise.all([
        fetch("/api/tasks"),
        fetch("/api/tasks?view=team"),
      ]);

      const allTasks = await allTasksRes.json();
      const teamTasksData = await teamTasksRes.json();

      // Process assigned tasks
      const allowedUsers = [
        "mdbarreda@innovphil.com",
        "aarce@innovphil.com",
        "carce@innovphil.com",
        "amlinguete@innovphil.com",
        "mcastilla@innovphil.com",
        "mjpanotes@innovphil.com",
        "mgpajarillo@innovphil.com",
        "jabayon@innovphil.com",
        "jksanjose@innovphil.com",
        "apanotes@innovphil.com",
        "vgarcia@innovphil.com",
        "mltperez@innovphil.com",
        "vantoc@innovphil.com",
        "mclladones@innovphil.com",
      ];

      if (allowedUsers.includes(currentUserEmail)) {
        const unassigned = (allTasks || []).filter(
          (task) =>
            Array.isArray(task.assignedTo) &&
            (task.assignedTo.length === 0 || task.assignedTo.includes("unassigned"))
        );
        setAssignedTasks(unassigned);
      } else {
        const managerTasks = (allTasks || []).filter(
          (task) => task.createdBy && task.createdBy !== currentUserEmail
        );
        setAssignedTasks(managerTasks);
      }

      // Process team stats
      const userStats = {};
      (teamTasksData || []).forEach((task) => {
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
    } catch (err) {
      console.error("Error fetching tasks data:", err);
    }
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
      "mjpanotes@innovphil.com",
      "smbernardo@innovphil.com",
      "mgpajarillo@innovphil.com",
      "jabayon@innovphil.com",
      "jksanjose@innovphil.com",
      "apanotes@innovphil.com",
      "vgarcia@innovphil.com",
      "mltperez@innovphil.com",
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

  

  const formatModalLabel = () => {
  if (modalPeriod === "daily") {
    return modalDate.toLocaleDateString();
  }
  if (modalPeriod === "weekly") {
    const start = new Date(modalDate);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
  }
  if (modalPeriod === "monthly") {
    return modalDate.toLocaleString("default", { month: "long", year: "numeric" });
  }
  return "";
};

const handleModalPrev = () => {
  if (modalPeriod === "daily") {
    setModalDate(prev => new Date(prev.setDate(prev.getDate() - 1)));
  } else if (modalPeriod === "weekly") {
    setModalDate(prev => new Date(prev.setDate(prev.getDate() - 7)));
  } else if (modalPeriod === "monthly") {
    setModalDate(prev => new Date(prev.setMonth(prev.getMonth() - 1)));
  }
};

const handleModalNext = () => {
  if (modalPeriod === "daily") {
    setModalDate(prev => new Date(prev.setDate(prev.getDate() + 1)));
  } else if (modalPeriod === "weekly") {
    setModalDate(prev => new Date(prev.setDate(prev.getDate() + 7)));
  } else if (modalPeriod === "monthly") {
    setModalDate(prev => new Date(prev.setMonth(prev.getMonth() + 1)));
  }
};

// Filter tasks for modal view
// Filter tasks for modal view (NO dueDate required)
const filterTasksForPeriod = (tasks) => {
  return tasks.filter((t) => {
    const tDate = t.dueDate
      ? new Date(t.dueDate)
      : t.createdAt
      ? new Date(t.createdAt)
      : null;

    if (!tDate) return false;

    if (modalPeriod === "daily") {
      const dayStr = modalDate.toISOString().split("T")[0];
      return tDate.toISOString().split("T")[0] === dayStr;
    }

    if (modalPeriod === "weekly") {
      const start = new Date(modalDate);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - start.getDay());

      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);

      return tDate >= start && tDate <= end;
    }

    if (modalPeriod === "monthly") {
      const month = modalDate.getMonth();
      const year = modalDate.getFullYear();
      return (
        tDate.getMonth() === month && tDate.getFullYear() === year
      );
    }

    return true;
  });
};

  const fetchUserTasks = async (user) => {
    const [taskRes, logRes] = await Promise.all([
      fetch(`/api/tasks?assignedTo=${encodeURIComponent(user)}`),
      fetch(`/api/task-log?user=${encodeURIComponent(user)}`)
    ]);

    const tasks = await taskRes.json();
    const logs = await logRes.json();

    const completed = [];
    const inProgress = [];
    const pending = [];

    // ✅ Aggregate durations from logs
    const durations = {};
    (logs || []).forEach((log) => {
      if (!log.taskId) return;
      durations[log.taskId] =
        (durations[log.taskId] || 0) + (log.durationSeconds || 0);
    });

    // ✅ Categorize tasks
    (tasks || []).forEach((task) => {
      if (!task.assignedTo?.includes(user)) return;

      if (task.status === "completed") completed.push(task);
      else if (task.status === "in-progress") inProgress.push(task);
      else pending.push(task);
    });

    setUserTasks({ completed, inProgress, pending });
    setTaskDurations(durations);
  };






  const handleUserClick = (user) => {
    setSelectedUser(user);
    fetchUserTasks(user);
    setIsModalOpen(true);
  };

  const handleAddTask = async () => {
    if (!title) return alert("Title is required");

    const assignedValue =
      Array.isArray(assignedTo) && assignedTo.length > 0
        ? assignedTo
        : ["unassigned"];

    // Create a separate task for each user
    for (const user of assignedValue) {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          priority,
          assignedTo: [user], // assign to one user only
          createdBy: currentUserEmail,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || `Failed to add task for ${user}`);
        return;
      }
    }

    setTitle("");
    setDescription("");
    setPriority("Medium");
    setAssignedTo([]);
    await fetchTasksData();
  };


  const handleDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      const durationSeconds = taskDurations[taskToDelete._id] || 0;

      const res = await fetch(`/api/tasks/${taskToDelete._id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete task");
        return;
      }

      await fetchTasksData();

      onTaskDeleted(durationSeconds, taskToDelete.assignedTo?.[0]);
    } catch (err) {
      console.error("Delete failed:", err);
      alert("Error deleting task");
    } finally {
      setConfirmDeleteOpen(false);
      setTaskToDelete(null);
    }
  };




const onTaskDeleted = (deletedTaskDurationSeconds, userEmail) => {
  // Dispatch a custom event
  window.dispatchEvent(
    new CustomEvent("taskDeleted", {
      detail: { deletedTaskDurationSeconds, userEmail },
    })
  );
};

  const toggleTaskSelection = (taskId) => {
  setSelectedTaskIds((prev) => {
    const next = new Set(prev);
    next.has(taskId) ? next.delete(taskId) : next.add(taskId);
    return next;
  });
};

const confirmBulkDelete = async () => {
  if (selectedTaskIds.size === 0) return;
  if (!confirm("Delete selected tasks?")) return;

  for (const id of selectedTaskIds) {
    const taskToDelete = assignedTasks.find((t) => t._id === id);
    const durationSeconds = taskDurations[id] || 0;

    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (res.ok && taskToDelete) {
      // Dispatch event for dashboard update
      onTaskDeleted(durationSeconds, taskToDelete.assignedTo?.[0]);
    }
  }

  // refresh modal data
  if (selectedUser) fetchUserTasks(selectedUser);

  setSelectedTaskIds(new Set());
  setDeleteMode(false);
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
                multiple
                value={assignedTo}
                onChange={(e) =>
                  setAssignedTo(Array.from(e.target.selectedOptions, (opt) => opt.value))
                }
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white h-40"
              >
                {teamMembers.map((user) => (
                  <option
                    key={user.id || user._id}
                    value={user.mail || user.userPrincipalName}
                  >
                    {user.displayName || user.mail || user.userPrincipalName}
                  </option>
                ))}
              </select>

              {/* Selected Users Chips */}
              {assignedTo.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {assignedTo.map((email) => (
                    <div
                      key={email}
                      className="flex items-center bg-blue-100 dark:bg-blue-800 text-blue-900 dark:text-blue-200 px-3 py-1 rounded-full text-sm"
                    >
                      <span>
                        {teamMembers.find(
                (u) => (u.mail || u.userPrincipalName) === email
              )
              ?.displayName ||
                          email}
                      </span>

                      <button
                        onClick={() =>
                          setAssignedTo((prev) => prev.filter((u) => u !== email))
                        }
                        className="ml-2 text-xs font-bold hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}


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
  onClick={() => {
    setTaskToDelete(task);
    setConfirmDeleteOpen(true);
  }}
  className="bg-red-600 hover:bg-red-500 text-white text-sm px-3 py-1 rounded"
>
  🗑 Delete
</button>

                    </div>

                    {task.description && <p className="text-sm">{task.description}</p>}
                    <p className="text-sm text-gray-500">Priority: {task.priority}</p>
                    {task.createdBy && (
  <p className="text-sm text-gray-600 dark:text-gray-400">
    Assigned by: {
      teamMembers.find(
        (u) =>
          (u.mail || u.userPrincipalName) === task.createdBy
      )?.displayName || task.createdBy
    }
  </p>
)}


                  </div>
                ))
              )}
            </div>
          </div>

          {/* Team Overview */}
<div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-md">
  <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-gray-100">Task Overview</h2>

  {/* View Toggle */}
  <div className="flex gap-3 mb-6">
    <button
      onClick={() => setTeamView("all")}
      className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
        teamView === "all"
          ? "bg-blue-900 text-white shadow-sm hover:bg-blue-800"
          : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
      }`}
    >
      All Users
    </button>
    <button
      onClick={() => setTeamView("myTeam")}
      className={`px-4 py-2 rounded-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
        teamView === "myTeam"
          ? "bg-blue-900 text-white shadow-sm hover:bg-blue-800"
          : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
      }`}
    >
      My Team
    </button>
  </div>

  <div className="space-y-4">
    {Object.keys(teamTasks).length === 0 ? (
      <p className="text-gray-500 dark:text-gray-400">No team tasks yet.</p>
    ) : (
      Object.entries(teamTasks)
        .filter(([user]) =>
          teamView === "all"
            ? true
            : TEAM_MAP[currentUserEmail] === TEAM_MAP[user]
        )
        .map(([user, stats]) => {
          const percent =
            stats.total > 0
              ? Math.round((stats.completed / stats.total) * 100)
              : 0;
          return (
            <div
              key={user}
              onClick={() => handleUserClick(user)}
              className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-md space-y-2 cursor-pointer hover:shadow-lg transition-all duration-300"
            >
              <h3 className="font-semibold text-gray-800 dark:text-gray-100">{user}</h3>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-blue-900 h-4 transition-all duration-500"
                  style={{ width: `${percent}%` }}
                ></div>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {stats.completed} / {stats.total} tasks completed ({percent}%)
              </p>
            </div>
          );
        })
    )}
  </div>
</div>

<Dialog
  open={confirmDeleteOpen}
  onClose={() => setConfirmDeleteOpen(false)}
  className="relative z-50"
>
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />

  <div className="fixed inset-0 flex items-center justify-center p-4">
    <Dialog.Panel className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6">
      <Dialog.Title className="text-lg font-bold text-red-600 mb-3">
        Confirm Delete
      </Dialog.Title>

      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
        Are you sure you want to delete{" "}
        <strong>{taskToDelete?.title}</strong>?  
        This action cannot be undone.
      </p>

      <div className="flex justify-end gap-3">
        <button
          onClick={() => {
            setConfirmDeleteOpen(false);
            setTaskToDelete(null);
          }}
          className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
        >
          Cancel
        </button>

        <button
          onClick={handleDeleteTask}
          className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
        >
          Delete
        </button>
      </div>
    </Dialog.Panel>
  </div>
</Dialog>


{/* Modal for User Tasks */}
<Dialog
  open={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  className="fixed inset-0 z-50 flex items-center justify-center"
>
  <div
    className="fixed inset-0 bg-black/50"
    aria-hidden="true"
    onClick={() => setIsModalOpen(false)}
  />

  <div
    className="bg-white dark:bg-gray-800 rounded-3xl p-6 z-50 max-w-3xl w-full mx-4 shadow-xl overflow-y-auto relative"
    style={{ maxHeight: "85vh" }}
    onClick={(e) => e.stopPropagation()}
  >
    {/* Modal Header */}
    <div className="flex justify-between items-center mb-6">

      {/* Period Navigation */}
      <div className="flex gap-3">
        {["daily", "weekly", "monthly"].map((p) => (
          <button
            key={p}
            onClick={() => setModalPeriod(p)}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
              modalPeriod === p
                ? "bg-blue-900 text-white shadow-sm hover:bg-blue-800"
                : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
            }`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Date Navigation + Close Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleModalPrev}
          className="px-3 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          &lt;
        </button>

        <span className="font-semibold text-gray-800 dark:text-gray-100">
          {formatModalLabel()}
        </span>

        <button
          onClick={handleModalNext}
          className="px-3 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          &gt;
        </button>

        {/* Close Button INSIDE modal */}
        <button
          onClick={() => setIsModalOpen(false)}
          className="ml-4 w-10 h-10 flex items-center justify-center bg-gray-100 dark:bg-gray-700 
                     rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 
                     text-2xl font-bold focus:outline-none transition"
          aria-label="Close"
          type="button"
        >
          &times;
        </button>
      </div>
    </div>

    <div className="flex justify-between items-center mb-6">
  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
    {selectedUser}'s Tasks
  </h2>

  {!deleteMode ? (
    <button
      onClick={() => setDeleteMode(true)}
      className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
    >
      Delete
    </button>
  ) : (
    <div className="flex gap-2">
      <button
        onClick={confirmBulkDelete}
        className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition"
      >
        Confirm
      </button>
      <button
        onClick={() => {
          setDeleteMode(false);
          setSelectedTaskIds(new Set());
        }}
        className="px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
      >
        Cancel
      </button>
    </div>
  )}
</div>


    {/* TASK SECTIONS */}
    <div className="space-y-6">

      {/* COMPLETED */}
<div className="bg-green-50 dark:bg-green-900 p-4 rounded-xl shadow-inner">
  <h3 className="font-semibold text-green-600 mb-2">✅ Completed</h3>

  {filterTasksForPeriod(userTasks.completed).length > 0 ? (
    <ul className="list-disc ml-5 text-gray-800 dark:text-gray-100">
      {filterTasksForPeriod(userTasks.completed).map((task) => (
        <li
  key={task._id}
  onClick={() => deleteMode && toggleTaskSelection(task._id)}
  className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition
    ${deleteMode ? "hover:bg-red-100 dark:hover:bg-red-900" : ""}
    ${selectedTaskIds.has(task._id) ? "bg-red-200 dark:bg-red-800" : ""}
  `}
>
  {deleteMode && (
    <input
      type="checkbox"
      readOnly
      checked={selectedTaskIds.has(task._id)}
      className="accent-red-600"
    />
  )}

  <span className="font-medium">{task.title}</span>

  <span className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
    {formatDuration(taskDurations[task._id])}
  </span>
</li>

      ))}
    </ul>
  ) : (
    <p className="text-sm text-gray-500 dark:text-gray-400">No completed tasks</p>
  )}
</div>

{/* IN PROGRESS */}
<div className="bg-yellow-50 dark:bg-yellow-900 p-4 rounded-xl shadow-inner">
  <h3 className="font-semibold text-yellow-600 mb-2">⏳ In Progress</h3>

  {filterTasksForPeriod(userTasks.inProgress).length > 0 ? (
    <ul className="list-disc ml-5 text-gray-800 dark:text-gray-100">
      {filterTasksForPeriod(userTasks.inProgress).map((task) => (
        <li
  key={task._id}
  onClick={() => deleteMode && toggleTaskSelection(task._id)}
  className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition
    ${deleteMode ? "hover:bg-red-100 dark:hover:bg-red-900" : ""}
    ${selectedTaskIds.has(task._id) ? "bg-red-200 dark:bg-red-800" : ""}
  `}
>
  {deleteMode && (
    <input
      type="checkbox"
      readOnly
      checked={selectedTaskIds.has(task._id)}
      className="accent-red-600"
    />
  )}

  <span className="font-medium">{task.title}</span>

  <span className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
    {formatDuration(taskDurations[task._id])}
  </span>
</li>

      ))}
    </ul>
  ) : (
    <p className="text-sm text-gray-500 dark:text-gray-400">No in-progress tasks</p>
  )}
</div>

{/* PENDING */}
<div className="bg-red-50 dark:bg-red-900 p-4 rounded-xl shadow-inner">
  <h3 className="font-semibold text-red-600 mb-2">📝 Pending</h3>

  {filterTasksForPeriod(userTasks.pending).length > 0 ? (
    <ul className="list-disc ml-5 text-gray-800 dark:text-gray-100">
      {filterTasksForPeriod(userTasks.pending).map((task) => (
        <li
  key={task._id}
  onClick={() => deleteMode && toggleTaskSelection(task._id)}
  className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer transition
    ${deleteMode ? "hover:bg-red-100 dark:hover:bg-red-900" : ""}
    ${selectedTaskIds.has(task._id) ? "bg-red-200 dark:bg-red-800" : ""}
  `}
>
  {deleteMode && (
    <input
      type="checkbox"
      readOnly
      checked={selectedTaskIds.has(task._id)}
      className="accent-red-600"
    />
  )}

  <span className="font-medium">{task.title}</span>

  <span className="text-xs text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
    {formatDuration(taskDurations[task._id])}
  </span>
</li>

      ))}
    </ul>
  ) : (
    <p className="text-sm text-gray-500 dark:text-gray-400">No pending tasks</p>
  )}
</div>


    </div>
  </div>
</Dialog>






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
