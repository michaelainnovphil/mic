"use client";

import React, { useEffect, useRef, useState } from "react";
import Draggable from "react-draggable";
import * as XLSX from "xlsx";

export default function TaskTimerWidget({ activeTask }) {
  const [timeLeft, setTimeLeft] = useState(9 * 60 * 60); // 9 hours
  const [visible, setVisible] = useState(false);
  const [task, setTask] = useState(null);
  const [taskType, setTaskType] = useState("");
  const intervalRef = useRef(null);
  const prevTaskRef = useRef(null);
  const logsRef = useRef([]);
  const timerStartAtRef = useRef(Date.now());
  const nodeRef = useRef(null);

  const formatTime = (seconds) => {
    const hrs = String(Math.floor(seconds / 3600)).padStart(2, "0");
    const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
    const secs = String(seconds % 60).padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  // Start/resume timer
  useEffect(() => {
    const stored = localStorage.getItem("taskTimerState");
    if (stored) {
      const { task: storedTask, taskType, timerStartAt } = JSON.parse(stored);
      const elapsed = Math.floor((Date.now() - timerStartAt) / 1000);
      const remaining = Math.max(9 * 60 * 60 - elapsed, 0);

      setTask(storedTask);
      setTaskType(taskType || "");
      setTimeLeft(remaining);
      setVisible(true);
      timerStartAtRef.current = timerStartAt;
    }
  }, []);

  // When active task changes
  useEffect(() => {
    if (!activeTask) return;

    const stored = localStorage.getItem("taskTimerState");
    const { task: storedTask } = stored ? JSON.parse(stored) : {};

    if (storedTask?.title === activeTask.task?.title) {
      // Same task, ignore
      return;
    }

    // Log previous task duration
    const prev = prevTaskRef.current;
    if (prev) {
      const endTime = new Date();
      const durationSeconds = Math.floor((endTime - prev.startTime) / 1000);
      logsRef.current.push({
        task: prev.title,
        taskType: prev.type,
        duration: formatTime(durationSeconds),
      });
    }

    // Set new task but don't reset timer
    setTask(activeTask.task);
    setTaskType(activeTask.taskType || "");
    prevTaskRef.current = {
      title: activeTask.task?.title,
      type: activeTask.taskType || "",
      startTime: new Date(),
    };
    setVisible(true);
  }, [activeTask]);

  // Store current task & time
  useEffect(() => {
    if (!task) return;

    localStorage.setItem(
      "taskTimerState",
      JSON.stringify({
        task,
        taskType,
        timerStartAt: timerStartAtRef.current,
      })
    );
  }, [task, taskType]);

  // Continuous countdown timer based on start time
  useEffect(() => {
    const totalDuration = 9 * 60 * 60; // 9 hours in seconds

    const updateTimeLeft = () => {
      const elapsed = Math.floor((Date.now() - timerStartAtRef.current) / 1000);
      const remaining = Math.max(totalDuration - elapsed, 0);
      setTimeLeft(remaining);
    };

    updateTimeLeft(); // initial call

    intervalRef.current = setInterval(updateTimeLeft, 1000);

    return () => clearInterval(intervalRef.current);
  }, []);


  // Export at 5:30 PM
  useEffect(() => {
    const now = new Date();
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      17,
      30,
      0
    );
    const msUntilEnd = endOfDay - now;

    if (msUntilEnd > 0) {
      const timeout = setTimeout(exportLogsToExcel, msUntilEnd);
      return () => clearTimeout(timeout);
    }
  }, []);

  const exportLogsToExcel = () => {
    const wsData = [["Task", "Type", "Duration"]];
    logsRef.current.forEach((log) => {
      wsData.push([log.task, log.taskType, log.duration]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Task Logs");
    XLSX.writeFile(workbook, "task_logs.xlsx");
  };

  const handleStop = () => {
    setVisible(false);
    clearInterval(intervalRef.current);
    localStorage.removeItem("taskTimerState");
  };

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

        <div className="text-center text-2xl font-mono mb-4">
          {formatTime(timeLeft)}
        </div>

        <button
          onClick={handleStop}
          className="w-full bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Stop
        </button>
      </div>
    </Draggable>
  );
}
