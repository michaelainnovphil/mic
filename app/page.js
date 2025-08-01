"use client";

import { useSession, signIn, signOut, SessionProvider } from "next-auth/react";
import { useEffect, useState } from "react";

function HomeContent() {
  const { data: session } = useSession();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (session?.role === "employee" && !window.taskCompleted) {
        e.preventDefault();
        e.returnValue = "Task not done yet!";
        return "Task not done yet!";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [session]);

  if (!session) {
    return <button onClick={() => signIn()}>Login with Entra</button>;
  }

  const handleAddTask = async () => {
    if (!title) return alert("Please enter a task title.");
    try {
      const res = await fetch("/api/task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title, description }),
      });
      if (res.ok) {
        alert("Task added!");
        setTitle("");
        setDescription("");
      } else {
        alert("Failed to add task.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred.");
    }
  };

  return (
    <div>
      <p>Welcome {session.user.name} - Role: {session.role}</p>
      <button onClick={() => signOut()}>Logout</button>

      <h3 className="mt-4">Add Task</h3>
      <input
        className="border p-1 my-1 block"
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title"
      />
      <textarea
        className="border p-1 my-1 block"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
      />
      <button onClick={handleAddTask} className="bg-blue-500 text-white px-3 py-1 rounded">
        Add Task
      </button>

      <CompleteTask />
    </div>
  );
}

export default function Home() {
  return (
    <SessionProvider>
      <HomeContent />
    </SessionProvider>
  );
}

function CompleteTask() {
  const complete = async () => {
    await fetch("/api/task", {
      method: "PUT",
    });
    window.taskCompleted = true;
    alert("Task completed!");
  };
  return (
    <div className="mt-6">
      <p>You have a pending task.</p>
      <button onClick={complete} className="bg-green-500 text-white px-3 py-1 rounded">
        Mark as Done
      </button>
    </div>
  );
}
