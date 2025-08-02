"use client";

import { useEffect, useState, useRef } from "react";

const DROPDOWN_OPTIONS = [
  "Team Huddle",
  "Adhoc",
  "Coffee Break",
  "Lunch Break",
  "Meeting",
];

export default function TaskTimerWidget() {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState("");
  const [remainingTime, setRemainingTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const widgetRef = useRef(null);
  const timerRef = useRef(null);

  // Load from localStorage
  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("taskTimer"));
    if (saved) {
      setSelectedTask(saved.selectedTask || "");
      setRemainingTime(saved.remainingTime || 9 * 60 * 60); // 9 hours
      setIsRunning(saved.isRunning || false);
      setIsVisible(saved.isVisible || false);
    } else {
      setRemainingTime(9 * 60 * 60);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem(
      "taskTimer",
      JSON.stringify({ selectedTask, remainingTime, isRunning, isVisible })
    );
  }, [selectedTask, remainingTime, isRunning, isVisible]);

  // Countdown effect
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setRemainingTime((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setIsRunning(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isRunning]);

  const handleStart = () => {
    setIsVisible(true);
    setIsRunning(true);
  };

  const handleStop = async () => {
    setIsRunning(false);
    setIsVisible(false);

    // Save log to backend
    await fetch("/api/task/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task: selectedTask,
        timeSpent: 9 * 60 * 60 - remainingTime,
        timestamp: new Date().toISOString(),
      }),
    });

    // Reset
    setRemainingTime(9 * 60 * 60);
    setSelectedTask("");
  };

  // Draggable logic
  useEffect(() => {
    const widget = widgetRef.current;
    let offsetX = 0, offsetY = 0, dragging = false;

    const onMouseDown = (e) => {
      dragging = true;
      offsetX = e.clientX - widget.offsetLeft;
      offsetY = e.clientY - widget.offsetTop;
    };

    const onMouseMove = (e) => {
      if (dragging) {
        widget.style.left = `${e.clientX - offsetX}px`;
        widget.style.top = `${e.clientY - offsetY}px`;
      }
    };

    const onMouseUp = () => {
      dragging = false;
    };

    widget.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    return () => {
      widget.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const formatTime = (seconds) => {
    const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const s = String(seconds % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  return (
    <>
      {!isVisible && (
        <button
          onClick={handleStart}
          className="fixed bottom-6 right-6 bg-blue-600 text-white px-4 py-2 rounded shadow"
        >
          Start Task
        </button>
      )}

      {isVisible && (
        <div
          ref={widgetRef}
          className="fixed top-20 left-20 bg-white border border-gray-300 shadow-lg p-4 rounded-xl w-80 cursor-move z-50"
          style={{ zIndex: 9999 }}
        >
          <label className="block mb-2 font-medium">Task Type</label>
          <select
            value={selectedTask}
            onChange={(e) => setSelectedTask(e.target.value)}
            className="w-full p-2 border rounded mb-4"
          >
            <option value="">Select...</option>
            {DROPDOWN_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          <div className="text-center text-2xl font-bold mb-4">
            {formatTime(remainingTime)}
          </div>

          <button
            onClick={handleStop}
            className="w-full bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded"
          >
            Stop
          </button>
        </div>
      )}
    </>
  );
}
