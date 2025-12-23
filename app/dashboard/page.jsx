// app/dashboard/page.jsx
"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";

function getCached(key, maxAgeMs = 5 * 60 * 1000) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > maxAgeMs) return null;
    return data;
  } catch {
    return null;
  }
}

function setCached(key, data) {
  localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
}

export default function UserList() {
  const [chiefs, setChiefs] = useState([]);
  const [groupedUsers, setGroupedUsers] = useState({});
  const [shiftStats, setShiftStats] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [hrStats, setHrStats] = useState({});
  const [overallHR, setOverallHR] = useState(null);

  // ------------------------------
  // Fetch Shift + Task Stats + Users
  // ------------------------------
  useEffect(() => {
  async function fetchUserStats() {
    const cacheKey = "dashboard_users";
    const cached = getCached(cacheKey);
    if (cached) {
      setChiefs(cached.chiefs);
      setGroupedUsers(cached.groupedUsers);
      setShiftStats(cached.shiftStats);
      return;
    }

    try {
      const [shiftRes, taskRes, usersRes] = await Promise.all([
        fetch("/api/shifts"),
        fetch("/api/user-task-stats"),
        fetch("/api/users"),
      ]);

      let userShifts = {};
      let taskStats = {};

      // --- Shift data ---
      if (shiftRes.ok) {
        const json = await shiftRes.json();
        userShifts = json.shiftHoursPerUser || json || {};
      } else {
        console.error("Failed /api/shifts:", await shiftRes.text());
      }

      // --- Task stats ---
      if (taskRes.ok) {
        const json = await taskRes.json();
        taskStats = json.stats || {};
      } else {
        console.error("Failed /api/user-task-stats:", await taskRes.text());
      }

      // Build shift stats
      const formattedStats = {};
      for (const [userId, shiftHoursRaw] of Object.entries(userShifts)) {
        const email = userId.toLowerCase().trim();
        const shiftHours = Number(shiftHoursRaw) || 0;

        const usedHours =
          Number(taskStats[email]?.durationSeconds || 0) / 3600;

        formattedStats[email] = {
          userId: email,
          shiftHours,
          usedHours,
          remaining: shiftHours - usedHours,
        };
      }

      // --- Grouping users ---
      const usersJson = await usersRes.json();
      const chiefsList = [];
      const groups = {};

      usersJson.value.forEach((user) => {
        if (!user.jobTitle || !user.assignedLicenses?.length) return;

        const email = (user.mail || user.userPrincipalName)
          ?.toLowerCase()
          .trim();

        const isChief = user.jobTitle.toLowerCase().includes("chief");

        // Attach their task stats
        user.taskStats = {
          completed: taskStats[email]?.completed || 0,
          pending: taskStats[email]?.pending || 0,
          totalDuration:
            (taskStats[email]?.durationSeconds || 0) / 3600,
        };

        if (isChief) {
          chiefsList.push(user);
        } else {
          if (!groups[user.jobTitle]) groups[user.jobTitle] = [];
          groups[user.jobTitle].push(user);
        }
      });

      setChiefs(chiefsList);
      setGroupedUsers(groups);
      setShiftStats(formattedStats);

      // Cache the result for 5 minutes
      setCached(cacheKey, {
        chiefs: chiefsList,
        groupedUsers: groups,
        shiftStats: formattedStats,
      });
    } catch (err) {
      console.error("Unexpected error in fetchUserStats:", err);
    }
  }

  fetchUserStats();
}, []);

  useEffect(() => {
  async function fetchHRStats() {
    const cacheKey = "dashboard_hr_stats";
    const cached = getCached(cacheKey);
    if (cached) {
      setOverallHR(cached.overallHR);
      setHrStats(cached.hrStats);
      return;
    }

    try {
      const period = "daily";
      const res = await fetch(`/api/public-hr-stats?period=${period}`);
      const data = await res.json();

      // ---- Compute Overall KPI (matching HR page) ----
      const present = data.daily?.present?.length || 0;
      const tardy = data.daily?.tardy?.length || 0;
      const absent = data.daily?.absent?.length || 0;

      const total = present + tardy + absent;

      const attendance = total > 0 ? Math.round((present / total) * 100) : 0;
      const tardiness = total > 0 ? Math.round((tardy / total) * 100) : 0;
      const adherence = 100 - tardiness; // same formula as HR page
      const disciplinary = absent;

      const overallHRData = {
        attendance,
        tardiness,
        adherence,
        disciplinary,
      };

      setOverallHR(overallHRData);
      setHrStats(data.userStats || {});

      // Cache the result for 5 minutes
      setCached(cacheKey, {
        overallHR: overallHRData,
        hrStats: data.userStats || {},
      });
    } catch (err) {
      console.error("Failed to fetch HR stats:", err);
      setOverallHR(null);
      setHrStats({});
    }
  }
  fetchHRStats();
}, []);

useEffect(() => {
  const handler = (e) => {
    const { deletedTaskDurationSeconds, userEmail } = e.detail;
    const durationHours = deletedTaskDurationSeconds / 3600;

    // Update shiftStats
    setShiftStats((prev) => {
      if (!prev[userEmail]) return prev;

      const updated = { ...prev };
      updated[userEmail] = {
        ...updated[userEmail],
        usedHours: Math.max(updated[userEmail].usedHours - durationHours, 0),
        remaining: Math.max(updated[userEmail].remaining + durationHours, 0),
      };
      return updated;
    });

    // Update selectedUser.taskStats if modal open
    setSelectedUser((prev) => {
      if (!prev) return prev;
      const email = (prev.mail || prev.userPrincipalName)?.toLowerCase().trim();
      if (email !== userEmail) return prev;

      return {
        ...prev,
        taskStats: {
          ...prev.taskStats,
          totalDuration: Math.max(
            (prev.taskStats?.totalDuration || 0) - durationHours,
            0
          ),
        },
      };
    });
  };

  window.addEventListener("taskDeleted", handler);
  return () => window.removeEventListener("taskDeleted", handler);
}, []);



  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="max-w-6xl mx-auto p-6">
        

        {/* === Chief / Stakeholders === */}
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
          Our Team
        </h2>

        {chiefs.length > 0 && (
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-200 mb-4">
              Stakeholders
            </h3>
            <div className="flex flex-wrap gap-4">
              {chiefs.map((user) => {
                const email = (user.mail || user.userPrincipalName)
                  .toLowerCase()
                  .trim();

                return (
                  <div
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow p-4 w-64 hover:shadow-md transition cursor-pointer"
                  >
                    <img
                      src={user.photo}
                      alt={user.displayName}
                      className="w-12 h-12 rounded-full"
                    />
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-2">
                      {user.displayName}
                    </h4>
                    <p className="text-gray-600 dark:text-gray-300 text-sm">{email}</p>
                    <p className="text-gray-500 dark:text-gray-400 text-xs italic mt-1">
                      {user.jobTitle}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* === Grouped Employees === */}
        {Object.keys(groupedUsers).length === 0 ? (
          <p className="text-gray-600 dark:text-gray-300">Loading...</p>
        ) : (
          Object.entries(groupedUsers)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([groupKey, users]) => (
              <div key={groupKey} className="mb-12">
                <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-200 mb-4">
                  {groupKey}
                </h3>
                <div className="space-y-6">
                  {Array.from({
                    length: Math.ceil(users.length / 2),
                  }).map((_, i) => (
                    <div
                      key={i}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-6"
                    >
                      {users
                        .slice(i * 2, i * 2 + 2)
                        .map((user) => {
                          const email = (
                            user.mail || user.userPrincipalName
                          )
                            ?.toLowerCase()
                            .trim();

                          return (
                            <div
                              key={user.id}
                              onClick={() => setSelectedUser(user)}
                              className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 hover:shadow-md transition cursor-pointer"
                            >
                              <img
                                src={user.photo}
                                alt={user.displayName}
                                className="w-12 h-12 rounded-full"
                              />
                              <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-2">
                                {user.displayName}
                              </h4>
                              <p className="text-gray-600 dark:text-gray-300 text-sm">
                                {email}
                              </p>
                              <p className="text-gray-500 dark:text-gray-400 text-xs italic mt-1">
                                {user.jobTitle}
                              </p>
                            </div>
                          );
                        })}
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>

      {/* === Modal === */}
      {selectedUser && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-white/95 dark:bg-gray-900 rounded-2xl shadow-xl p-6 max-w-md w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-3 right-3 text-gray-500 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white text-xl"
            >
              ✕
            </button>
            {/* Header */}
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {selectedUser.displayName}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {selectedUser.mail || selectedUser.userPrincipalName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                {selectedUser.jobTitle}
              </p>
            </div>
            {/* Shift + Task Stats */}
            {(() => {
              const email = (
                selectedUser.mail || selectedUser.userPrincipalName
              )
                ?.toLowerCase()
                .trim();

              const shift =
                shiftStats[email] ||
                {
                  shiftHours: 0,
                  usedHours: 0,
                  remaining: 0,
                };

              return (
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
                  <p>
                    ⏱ <strong>Shift Hours:</strong>{" "}
                    {shift.shiftHours.toFixed(2)} hrs
                  </p>
                  <p>
                    📋 <strong>Task Duration:</strong>{" "}
                    {(
                      selectedUser.taskStats?.totalDuration ?? 0
                    ).toFixed(2)}{" "}
                    hrs
                  </p>
                  <p className="text-green-600 dark:text-green-400 font-medium">
                    <strong>Remaining:</strong>{" "}
                    {shift.remaining.toFixed(2)} hrs
                  </p>
                  <p className="mt-2">
                    ✅ Completed:{" "}
                    {selectedUser.taskStats?.completed ?? 0} | ⏳ Pending:{" "}
                    {selectedUser.taskStats?.pending ?? 0}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}