// app/tasks/page.jsx

"use client";

import { useEffect, useState } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import Header from "@/components/Header";
import TaskTimerWidget from "@/components/TaskTimerWidget";
import { Dialog } from "@headlessui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"; 
import { TEAM_MAP } from "@/lib/teamMap";


function TasksContent() {
  const [tasks, setTasks] = useState([]);
  const [unassignedTasks, setUnassignedTasks] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filter, setFilter] = useState("active");
  const { data: session } = useSession();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [activeTask, setActiveTask] = useState(null);
  

  useEffect(() => {
    if (session?.user?.email) fetchTasks();
  }, [filter, session?.user?.email]);

  const fetchTasks = async () => {
  try {
    const res = await fetch("/api/tasks");
    const data = await res.json();

    // Filter tasks by status
    const filtered = data.filter((task) => {
      if (filter === "all") return true;
      if (filter === "completed") return task.status === "completed";
      return task.status === "pending" || task.status === "in-progress";
    });

    const myEmail = session.user.email.toLowerCase();

    // My tasks
    let mine = filtered.filter(
      (task) =>
        Array.isArray(task.assignedTo) &&
        task.assignedTo.some((a) => a?.toLowerCase() === myEmail)
    );

    // Sort by priority (High → Medium → Low)
    mine.sort((a, b) => {
      const priorityOrder = { High: 1, Medium: 2, Low: 3 };
      return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
    });

    setTasks(mine);

    // Unassigned tasks (restore correct logic)
    const unassigned = filtered.filter((task) => {
      if (!task.assignedTo) return true;
      const assigned = Array.isArray(task.assignedTo)
        ? task.assignedTo.map((a) => a?.toLowerCase().trim())
        : [task.assignedTo.toString().toLowerCase().trim()];
      return assigned.length === 0 || assigned.every((a) => !a || a === "unassigned");
    });

    //  sort unassigned tasks by priority
    unassigned.sort((a, b) => {
      const priorityOrder = { High: 1, Medium: 2, Low: 3 };
      return (priorityOrder[a.priority] || 4) - (priorityOrder[b.priority] || 4);
    });

    setUnassignedTasks(unassigned);
  } catch (err) {
    console.error(err);
  }
};


  // Add new task
  const handleAddTask = async () => {
    if (!title) return alert("Title is required");

    const payload = {
      title,
      description,
      assignedTo: assignedTo ? [assignedTo] : [],
      priority,
    };

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return alert(data.error || "Failed to add task");
      }

      setTitle("");
      setDescription("");
      setPriority("Medium");
      setAssignedTo("");
      fetchTasks();
      setDrawerOpen(false);
    } catch (err) {
      console.error(err);
      alert("An error occurred while adding the task");
    }
  };

  // Assign selected task to me
  const handleAssignToMe = async () => {
    if (!selectedTask || !session?.user?.email) return;

    try {
      const res = await fetch(`/api/tasks/${selectedTask._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedTo: [session.user.email] }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return alert(data.error || "Failed to assign task");
      }

      setModalOpen(false);
      setSelectedTask(null);
      fetchTasks();
    } catch (err) {
      console.error(err);
      alert("An error occurred while assigning the task");
    }
  };

  return (
  <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">

    {/* Header (full width) */}
    <Header />

    {/* Body: Drawer + Main content */}
    <div className="flex flex-1 overflow-hidden">
      {/* Drawer */}
      <div
          className={`bg-white dark:bg-gray-800 shadow-lg transition-all duration-300 flex flex-col ${

          drawerOpen ? "w-80" : "w-16"
        }`}
      >
        <div className="flex justify-end p-2">
          <button onClick={() => setDrawerOpen(!drawerOpen)} className="p-1">
  {drawerOpen ? (
    <ChevronLeftIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
  ) : (
    <ChevronRightIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
  )}
</button>

        </div>
        {drawerOpen && (
          <div className="p-4 flex-1 overflow-y-auto">
            <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-300 mb-4">
              Workbasket
            </h2>
            {unassignedTasks.length > 0 ? (
              <ul className="space-y-3">
                {unassignedTasks.map((task) => (
                  <li
                    key={task._id}
                    onClick={() => {
                      setSelectedTask(task);
                      setModalOpen(true);
                    }}
                    className="p-3 border rounded-lg shadow-sm bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
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
              <p className="text-gray-500 dark:text-gray-400">No unassigned tasks.</p>
            )}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <h1 className="text-3xl font-bold mb-6 text-blue-900 dark:text-blue-300">
            My Tasks
          </h1>

          {/* Filter buttons */}
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

          {/* Task list */}
<div className="space-y-4 flex-1 overflow-y-auto">
  {tasks.length === 0 ? (
    <p className="text-gray-500 dark:text-gray-400">No tasks yet.</p>
  ) : (
    tasks.map((task) => {
      // Status badge colors
      let statusColor = "bg-gray-300 text-gray-800";
      if (task.status === "pending") statusColor = "bg-blue-100 text-blue-800";
      else if (task.status === "in-progress") statusColor = "bg-green-100 text-green-800";
      else if (task.status === "completed") statusColor = "bg-gray-200 text-gray-700";

      // Priority indicator color
  let priorityColor =
    task.priority === "High"
      ? "bg-red-100 text-red-700"
      : task.priority === "Low"
      ? "bg-yellow-100 text-yellow-700"
      : "bg-gray-100 text-gray-700";

      return (
        <div
          key={task._id}
          className="bg-white dark:bg-gray-800 p-5 rounded-xl shadow flex justify-between items-center gap-4"
        >
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-blue-900 dark:text-blue-300">
              {task.title}

              </h3>
              {task.priority === "High" && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-red-500 text-white rounded-full">
              HIGH
            </span>
          )}
            
            </div>
            
            {task.description && (
              <p className="text-sm text-gray-600 dark:text-gray-300">{task.description}</p>
            )}
            {task.assignedTo && task.assignedTo.length > 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Assigned to: <strong>{task.assignedTo.join(", ")}</strong>
              </p>
            )}
            <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
              {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
            </span>
          </div>

          {/* Start Button triggers TaskTimerWidget */}
{/* Buttons depending on task status */}
<div className="flex gap-2">
  {task.status === "pending" && (
    <button
      onClick={async () => {
        try {
          const res = await fetch(`/api/tasks/${task._id}/status`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "in-progress" }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            return alert(data.error || "Failed to start task");
          }

          const updatedTask = await res.json();
          localStorage.setItem(
            "activeTask",
            JSON.stringify({
              task: updatedTask,
              taskType: task.type || "",
            })
          );
          window.dispatchEvent(new Event("storage"));
          fetchTasks();
        } catch (err) {
          console.error(err);
          alert("Error starting task");
        }
      }}
      className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
    >
      Start
    </button>
  )}

  {task.status === "in-progress" && (
    <>
      <button
        onClick={() => {
          // Resume just reloads activeTask into TaskTimerWidget
          localStorage.setItem(
            "activeTask",
            JSON.stringify({
              task,
              taskType: task.type || "",
            })
          );
          window.dispatchEvent(new Event("storage"));
        }}
        className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
      >
        Resume
      </button>

      <button
        onClick={async () => {
          try {
            const res = await fetch(`/api/tasks/${task._id}/status`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: "completed" }),
            });

            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              return alert(data.error || "Failed to complete task");
            }

            await res.json();
            fetchTasks();
          } catch (err) {
            console.error(err);
            alert("Error completing task");
          } 
        }}
        className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
      >
        Complete
      </button>
    </>
  )}
</div>





        </div>
      );
    })
  )}
</div>




        </div>
        <TaskTimerWidget activeTask={activeTask} />
      </div>
    </div>

    {/* Assign Modal */}
    <Dialog
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      className="relative z-50"
    >
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="bg-white/90 dark:bg-gray-800/90 p-6 rounded-xl shadow-xl w-96 backdrop-blur">
          <h3 className="text-lg font-bold mb-4 text-blue-900 dark:text-blue-300">
            Assign Task
          </h3>
          {selectedTask && (
            <>
              <p className="mb-2">
                Do you want to assign <strong>{selectedTask.title}</strong> to yourself?
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignToMe}
                  className="px-4 py-2 bg-blue-900 text-white rounded-lg"
                >
                  Assign to Me
                </button>
              </div>
            </>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
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
