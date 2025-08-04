"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import axios from "axios";

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

export default function TaskTimerWidget() {
  const { data: session } = useSession();
  const [visible, setVisible] = useState(false);
  const [task, setTask] = useState(null);
  const [taskType, setTaskType] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);

  const widgetRef = useRef(null);

  const [position, setPosition] = useState({ x: 100, y: 100 });
  const isDragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const updateFromStorage = () => {
      const stored = localStorage.getItem("activeTask");
      const timerStartAt = parseInt(localStorage.getItem("timerStartAt"), 10);

      if (stored && timerStartAt) {
        const parsed = JSON.parse(stored);
        const elapsed = Math.floor((Date.now() - timerStartAt) / 1000);
        const remaining = Math.max(9 * 60 * 60 - elapsed, 0);

        if (remaining > 0) {
          setTask(parsed.task);
          setTaskType(parsed.taskType || "");
          setTimeLeft(remaining);
          setVisible(true);
        } else {
          localStorage.removeItem("activeTask");
          localStorage.removeItem("timerStartAt");
          setVisible(false);
        }
      }
    };

    updateFromStorage();
    window.addEventListener("storage", updateFromStorage);
    return () => window.removeEventListener("storage", updateFromStorage);
  }, []);

  useEffect(() => {
    if (!visible || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const updated = prev - 1;
        if (updated <= 0) {
          localStorage.removeItem("activeTask");
          localStorage.removeItem("timerStartAt");
          setVisible(false);
          return 0;
        }
        return updated;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [visible, timeLeft]);

  const handleMouseDown = (e) => {
    isDragging.current = true;
    offset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleMouseMove = (e) => {
    if (!isDragging.current) return;
    setPosition({
      x: e.clientX - offset.current.x,
      y: e.clientY - offset.current.y,
    });
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  useEffect(() => {
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    const fetchMeetings = async () => {
      try {
        const now = new Date();
        const start = new Date(now);
        start.setHours(8, 30, 0, 0);
        const end = new Date(now);
        end.setHours(17, 30, 0, 0);

        const res = await axios.get("/api/graph/calendar", {
          params: {
            start: start.toISOString(),
            end: end.toISOString(),
          },
          headers: {
            Authorization: `Bearer ${session?.accessToken}`,
          },
        });

        const events = res.data.value;

        if (events.length > 0) {
          const activeMeeting = events.find((event) => {
            const startTime = new Date(event.start.dateTime).getTime();
            const endTime = new Date(event.end.dateTime).getTime();
            const now = Date.now();
            return now >= startTime && now <= endTime;
          });

          if (activeMeeting && !localStorage.getItem("activeTask")) {
            const startTime = Date.now();
            localStorage.setItem("activeTask", JSON.stringify({
              task: { title: activeMeeting.subject },
              taskType: "Meeting",
            }));
            localStorage.setItem("timerStartAt", `${startTime}`);
            setTask({ title: activeMeeting.subject });
            setTaskType("Meeting");
            setTimeLeft(9 * 60 * 60);
            setVisible(true);
          }
        }
      } catch (err) {
        console.error("Failed to fetch calendar events", err);
      }
    };

    if (session?.accessToken) {
      fetchMeetings();
    }
  }, [session?.accessToken]);

  if (!visible) return null;

  return (
    <div
      ref={widgetRef}
      onMouseDown={handleMouseDown}
      style={{
        position: "fixed",
        left: `${position.x}px`,
        top: `${position.y}px`,
        zIndex: 9999,
        width: "320px",
        cursor: "move",
      }}
      className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow-2xl rounded-xl p-4"
    >
      <div className="text-sm text-gray-700 dark:text-gray-200 mb-2">
        <strong>Task:</strong> {task?.title || "N/A"}
      </div>

      <select
        value={taskType}
        onChange={(e) => {
          const newType = e.target.value;
          setTaskType(newType);

          const current = JSON.parse(localStorage.getItem("activeTask") || "{}");
          localStorage.setItem(
            "activeTask",
            JSON.stringify({ ...current, taskType: newType })
          );
        }}
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
        onClick={() => {
          localStorage.removeItem("activeTask");
          localStorage.removeItem("timerStartAt");
          setVisible(false);
        }}
        className="w-full bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded"
      >
        Stop
      </button>
    </div>
  );
}
