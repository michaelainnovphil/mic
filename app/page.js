"use client";

import { useSession, signIn, signOut, SessionProvider } from "next-auth/react";
import { useEffect } from "react";

function HomeContent() {
  const { data: session } = useSession();

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

  return (
    <div>
      <p>Welcome {session.user.name} - Role: {session.role}</p>
      <button onClick={() => signOut()}>Logout</button>

      {session.role === "team_lead" ? (
        <AssignTask />
      ) : (
        <CompleteTask />
      )}
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

function AssignTask() {
  const assign = async () => {
    await fetch("/api/task", {
      method: "POST",
    });
    alert("Task assigned");
  };
  return <button onClick={assign}>Assign Task</button>;
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
    <div>
      <p>You have a pending task.</p>
      <button onClick={complete}>Mark as Done</button>
    </div>
  );
}
