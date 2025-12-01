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
      if (remaining === 0) stopShift();
    }, 1000);
  };

  const exportLogsToExcel = async () => {
  if (!logsRef.current || logsRef.current.length === 0) {
    alert("No task logs to export.");
    return;
  }

  const today = new Date();
  const formattedDate = today.toISOString().split("T")[0];

  const wsData = [["Date", "Task", "Description", "Type", "Productive", "Duration (hh:mm:ss)"]];
  logsRef.current.forEach((log) => {
    wsData.push([
      formattedDate,
      log.task || "",
      log.description || "",
      log.taskType || "",
      log.isProductive ? "Yes" : "No",
      formatTime(log.durationSeconds || 0),
    ]);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(wsData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Task Logs");

  XLSX.writeFile(workbook, `task_logs_${formattedDate}.xlsx`);

  // Do NOT clear logs here!
  await uploadLogsToDatabase();
};

  const uploadLogsToDatabase = async () => {
    if (!logsRef.current || logsRef.current.length === 0) return;

    for (const logEntry of logsRef.current) {
      try {
        await fetch("/api/task-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user: Array.isArray(logEntry.email) ? logEntry.email[0] : logEntry.email || "unknown",
            task: logEntry.task || "Untitled Task",
            durationSeconds: logEntry.durationSeconds || 0,
            taskType: logEntry.taskType || "",
            isProductive: logEntry.isProductive || false, 
            description: logEntry.description || "",
            timestamp: logEntry.timestamp ? new Date(logEntry.timestamp) : new Date(),
            taskId: logEntry.taskId || null,
          }),
        });
      } catch (err) {
        console.error("Failed to save log to DB:", err);
      }
    }
    
  };

  const handleStopTask = async () => {
    if (!prevTaskRef.current) return;

    const endTime = new Date();
    const durationSeconds = Math.floor(
      (endTime - prevTaskRef.current.startTime) / 1000
    );

    const logEntry = {
      task: prevTaskRef.current.title,
      taskType: prevTaskRef.current.type || "",
      isProductive: prevTaskRef.current.type === "Productivity Hours", 
      description: prevTaskRef.current.description || "",
      durationSeconds,
      email: prevTaskRef.current.assignedTo || "unknown",
      taskId: prevTaskRef.current.id,
      timestamp: new Date().toISOString(),
    };

    logsRef.current.push(logEntry);
    localStorage.setItem("taskLogs", JSON.stringify(logsRef.current));

    try {
      await fetch("/api/task-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: Array.isArray(logEntry.email) ? logEntry.email[0] : logEntry.email || "unknown",
          task: logEntry.task || "Untitled Task",
          durationSeconds: logEntry.durationSeconds || 0,
          taskType: logEntry.taskType || "",
          isProductive: logEntry.isProductive || false, 
          description: logEntry.description || "",
          timestamp: logEntry.timestamp ? new Date(logEntry.timestamp) : new Date(),
          taskId: logEntry.taskId || null,
        }),
      });
    } catch (err) {
      console.error("Failed to save log:", err);
    }

    prevTaskRef.current = null;
  };

  const stopShift = async () => {
    await handleStopTask();
    await uploadLogsToDatabase();
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
    logsRef.current = JSON.parse(localStorage.getItem("taskLogs")) || [];

    startShiftTimer();

    const handleStorage = () => {
      const stored = localStorage.getItem("activeTask");
      if (!stored) return;

      const { task: newTask, taskType, startTime } = JSON.parse(stored);
      setTask(newTask);
      setTaskType(taskType || "");
      setVisible(true);

      // UPDATED: Only stop the previous task if it's a different task (not resuming the same one).
      // This prevents accidental stopping on navigation/remount.
      const isSameTask = prevTaskRef.current && prevTaskRef.current.id === newTask._id;
      if (prevTaskRef.current && !isSameTask) {
        console.log("Stopping previous task before resuming new one"); // Optional debug log
        handleStopTask();
      }

      prevTaskRef.current = {
        id: newTask._id,
        title: newTask.title,
        description: newTask.description,
        type: taskType || "",
        assignedTo: newTask.assignedTo || "unknown",
        startTime: startTime ? new Date(startTime) : new Date(),
      };
      console.log("Resumed task:", prevTaskRef.current.title); // Optional debug log
      startShiftTimer();
    };

    window.addEventListener("storage", handleStorage);
    handleStorage();
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (prevTaskRef.current) {
      prevTaskRef.current.type = taskType;
    }
  }, [taskType]);

  if (!visible || !task) return null;

  return (
    <Draggable nodeRef={nodeRef}>
      <div
        ref={nodeRef}
        className="fixed z-50 bottom-4 right-4 bg-white dark:bg-gray-900 shadow-xl rounded-2xl p-4 w-80 border border-gray-300 dark:border-gray-700"
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

        <div className="text-center text-2xl font-mono mb-4 text-gray-900 dark:text-white">
          {formatTime(timeLeft)}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleStopTask}
            disabled={!prevTaskRef.current}
            className={`flex-1 px-4 py-2 rounded text-white ${
              prevTaskRef.current ? "bg-red-500 hover:bg-red-600" : "bg-gray-300 cursor-not-allowed"
            }`}
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
