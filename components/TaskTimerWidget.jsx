// components/TaskTimerWidget.jsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Draggable from "react-draggable";
import * as XLSX from "xlsx";

export default function TaskTimerWidget() {
  const [timeLeft, setTimeLeft] = useState(9 * 60 * 60);
  const [visible, setVisible] = useState(false);
  const [task, setTask] = useState(null);
  const [taskType, setTaskType] = useState("");
  const intervalRef = useRef(null);
  const prevTaskRef = useRef(null);
  const logsRef = useRef([]);
  const shiftStartRef = useRef(null);
  const nodeRef = useRef(null);

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startShiftTimer = () => {
    if (!shiftStartRef.current) {
      const stored = localStorage.getItem("shiftStartAt");
      if (stored) shiftStartRef.current = parseInt(stored, 10);
      else {
        shiftStartRef.current = Date.now();
        localStorage.setItem("shiftStartAt", shiftStartRef.current);
      }
    }

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - shiftStartRef.current) / 1000);
      const remaining = Math.max(9 * 60 * 60 - elapsed, 0);
      setTimeLeft(remaining);
      if (remaining === 0) stopShift(); // auto-stop at end of shift
    }, 1000);
  };

    const exportLogsToExcel = () => {
  if (!logsRef.current || logsRef.current.length === 0) {
    alert("No task logs to export.");
    return;
  }

  // Format today's date as YYYY-MM-DD
  const today = new Date();
  const formattedDate = today.toISOString().split("T")[0]; // "2025-08-21"

  // Header row (added "Date" as first column)
  const wsData = [["Date", "Task", "Description", "Type", "Duration (hh:mm:ss)"]];

  // Add log rows
  logsRef.current.forEach((log) => {
    wsData.push([
      formattedDate,                 // Today's date
      log.task || "",                // Task title
      log.description || "",         // Task description
      log.taskType || "",            // Task type
      log.duration || "00:00:00",    // Duration
    ]);
  });

  // Create worksheet and workbook
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Task Logs");

  // Save file
  XLSX.writeFile(workbook, "task_logs.xlsx");
};



  const handleStopTask = () => {
    if (!prevTaskRef.current) return;

    const endTime = new Date();
    const durationSeconds = Math.floor((endTime - prevTaskRef.current.startTime) / 1000);

    logsRef.current.push({
      task: prevTaskRef.current.title,
      taskType: prevTaskRef.current.type || "",
      description: prevTaskRef.current.description || "",
      duration: formatTime(durationSeconds),
    });

    fetch("/api/update-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        taskId: prevTaskRef.current.id,
        durationSeconds,
        durationHours: durationSeconds / 3600,
      }),
    }).catch(console.error);

    prevTaskRef.current = null;
  };

  const stopShift = () => {
    handleStopTask();
    clearInterval(intervalRef.current);
    shiftStartRef.current = null;
    localStorage.removeItem("shiftStartAt");
    localStorage.removeItem("activeTask");
    setVisible(false);
    setTask(null);
    setTaskType("");
    setTimeLeft(9 * 60 * 60);
  };

  useEffect(() => {
    startShiftTimer();

    const handleStorage = () => {
      const stored = localStorage.getItem("activeTask");
      if (!stored) return;

      const { task: newTask, taskType } = JSON.parse(stored);
      setTask(newTask);
      setTaskType(taskType || "");
      setVisible(true);

      if (prevTaskRef.current) handleStopTask();

      prevTaskRef.current = {
        id: newTask._id,
        title: newTask.title,
        description: newTask.description,
        type: taskType || "",
        startTime: new Date(),
      };
    };

    window.addEventListener("storage", handleStorage);
    handleStorage(); // handle current localStorage immediately
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

    useEffect(() => {
    if (prevTaskRef.current) {
      prevTaskRef.current.type = taskType; // keep ref in sync with dropdown
    }
  }, [taskType]);

  if (!visible || !task) return null;

  return (
    <Draggable nodeRef={nodeRef}>
      <div
        ref={nodeRef}
        className="fixed z-50 bottom-4 right-4 bg-white shadow-xl rounded-2xl p-4 w-80 border border-gray-300"
      >
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-bold text-lg">Task Timer</h2>
          <button
            onClick={exportLogsToExcel}
            className="text-sm bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
          >
            Export
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-1">
          <strong>Task:</strong> {task.title}
        </p>

        <label className="block text-sm text-gray-500 mb-2">
          <strong>Type:</strong>
          <select
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
          >
            <option value="">Select Type</option>
            <option value="Meeting">Meeting</option>
            <option value="Adhoc">Adhoc</option>
            <option value="Lunch Break">Lunch Break</option>
            <option value="Coffee Break">Coffee Break</option>
            <option value="Productivity Hours">Productivity Hours</option>
          </select>
        </label>

        <div className="text-center text-2xl font-mono mb-4">{formatTime(timeLeft)}</div>

        <div className="flex gap-2">
          <button
            onClick={handleStopTask}
            className="flex-1 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Stop Task
          </button>
          <button
            onClick={stopShift}
            className="flex-1 bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
          >
            Stop Shift
          </button>
        </div>
      </div>
    </Draggable>
  );
}
