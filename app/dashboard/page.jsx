// app/dashboard/page.jsx
"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";

export default function UserList() {
  const [chiefs, setChiefs] = useState([]);
  const [groupedUsers, setGroupedUsers] = useState({});
  const [shiftStats, setShiftStats] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [kpiData, setKpiData] = useState(null);
  const [hrStats, setHrStats] = useState({}); // New state for HR percentages

  useEffect(() => {
    async function fetchUserStats() {
      try {
        const [shiftRes, taskRes, usersRes] = await Promise.all([
          fetch("/api/shifts"),
          fetch("/api/user-task-stats"),
          fetch("/api/users"),
        ]);

        let userShifts = {};
        let taskStats = {};

        // --- Get shift data ---
        if (shiftRes.ok) {
          const json = await shiftRes.json();
          userShifts = json.shiftHoursPerUser || json || {};
        } else {
          console.error("Failed /api/shifts:", await shiftRes.text());
        }

        // --- Get task stats ---
        if (taskRes.ok) {
          const json = await taskRes.json();
          taskStats = json.stats || {};
        } else {
          console.error("Failed /api/user-task-stats:", await taskRes.text());
        }

        // --- Build shiftStats ---
        const formattedStats = {};
        for (const [userId, shiftHoursRaw] of Object.entries(userShifts)) {
          const normalizedEmail = userId.toLowerCase().trim();
          const shiftHours = Number(shiftHoursRaw) || 0;

          // convert durationSeconds → hours
          const usedHours =
            Number(taskStats[normalizedEmail]?.durationSeconds || 0) / 3600;

          const remaining = shiftHours - usedHours;

          formattedStats[normalizedEmail] = {
            userId: normalizedEmail,
            shiftHours,
            usedHours,
            remaining,
          };
        }

        setShiftStats(formattedStats);

        // --- Handle user grouping ---
        const usersJson = await usersRes.json();
        const chiefsList = [];
        const groups = {};

        usersJson.value.forEach((user) => {
          if (!user.jobTitle || !user.assignedLicenses?.length) return;
          const jobTitle = user.jobTitle;
          const isChief = jobTitle.toLowerCase().includes("chief");
          const userEmail = (user.mail || user.userPrincipalName)?.toLowerCase().trim();

          // Keep all stats: completed, pending, totalDuration
          user.taskStats = {
            completed: taskStats[userEmail]?.completed || 0,
            pending: taskStats[userEmail]?.pending || 0,
            totalDuration: (taskStats[userEmail]?.durationSeconds || 0) / 3600, // convert to hours
          };

          if (isChief) {
            chiefsList.push(user);
          } else {
            if (!groups[jobTitle]) groups[jobTitle] = [];
            groups[jobTitle].push(user);
          }
        });

        setChiefs(chiefsList);
        setGroupedUsers(groups);
      } catch (err) {
        console.error("Unexpected error in fetchUserStats:", err);
      }
    }

    fetchUserStats();
  }, []);

  useEffect(() => {
    async function fetchKPI() {
      try {
        const month = "10"; // You can make this dynamic
        const year = "2025";
        const res = await fetch(`/api/kpi?month=${month}&year=${year}`);
        const data = await res.json();
        setKpiData(data);
      } catch (err) {
        setKpiData(null);
      }
    }
    fetchKPI();
  }, []);

  // New: Fetch HR stats (percentages only)
  useEffect(() => {
    async function fetchHRStats() {
      try {
        const period = "daily"; // Or make dynamic
        const res = await fetch(`/api/public-hr-stats?period=${period}`);
        const data = await res.json();
        setHrStats(data.userStats || {});
      } catch (err) {
        console.error("Failed to fetch HR stats:", err);
        setHrStats({});
      }
    }
    fetchHRStats();
  }, []);

  // Helper to get KPI for a user
  function getUserKPI(email) {
    if (!kpiData || !kpiData.users) return null;
    return kpiData.users.find((u) => u.email === email);
  }

  // Helper to get HR stats for a user
  function getUserHRStats(email) {
    const normalizedEmail = email.toLowerCase().trim();
    return hrStats[normalizedEmail] || null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-6xl mx-auto p-6">
        {/* Show overall KPI */}
        {kpiData && kpiData.overall && (
          <div className="mb-8 bg-white rounded-xl shadow p-4">
            <h3 className="text-lg font-semibold mb-2 text-blue-900">Overall KPI</h3>
            <ul className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {Object.entries(kpiData.overall).map(([key, value]) => (
                <li key={key} className="font-medium text-gray-700">
                  {key}: <span className="font-bold">{value}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Our Team</h2>

        {chiefs.length > 0 && (
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-blue-900 mb-4">Stakeholders</h3>
            <div className="flex flex-wrap gap-4">
              {chiefs.map((user) => {
                const email = (user.mail || user.userPrincipalName)?.toLowerCase().trim();
                const userKPI = getUserKPI(email);
                const userHR = getUserHRStats(email);
                return (
                  <div
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className="bg-white rounded-2xl shadow p-4 w-64 hover:shadow-md transition cursor-pointer"
                  >
                    <img
                      src={user.photo}
                      alt={user.displayName}
                      style={{ width: 48, height: 48, borderRadius: "50%" }}
                    />
                    <h4 className="text-lg font-semibold text-gray-900 mb-1">
                      {user.displayName}
                    </h4>
                    <p className="text-gray-600 text-sm">
                      {user.mail || user.userPrincipalName}
                    </p>
                    <p className="text-gray-500 text-xs mt-1 italic">{user.jobTitle}</p>
                    {/* KPI display */}
                    {userKPI && (
                      <div className="mt-2 text-xs text-blue-900">
                        Attendance: {userKPI.attendance}%<br />
                        Tardiness: {userKPI.tardiness}%<br />
                        Utilization: {userKPI.utilizationScore}%
                      </div>
                    )}
                    {/* HR Stats display */}
                    {userHR && (
                      <div className="mt-2 text-xs text-green-900">
                        Adherence: {userHR.adherence}%<br />
                        Disciplinary: {userHR.da}%
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {Object.keys(groupedUsers).length === 0 ? (
          <p className="text-gray-600">Loading...</p>
        ) : (
          Object.entries(groupedUsers)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([groupKey, users]) => (
              <div key={groupKey} className="mb-12">
                <h3 className="text-xl font-semibold text-blue-900 mb-4">{groupKey}</h3>
                <div className="space-y-6">
                  {Array.from({ length: Math.ceil(users.length / 2) }).map((_, i) => (
                    <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {users.slice(i * 2, i * 2 + 2).map((user) => {
                        const email = (user.mail || user.userPrincipalName)?.toLowerCase().trim();
                        const userKPI = getUserKPI(email);
                        const userHR = getUserHRStats(email);
                        return (
                          <div
                            key={user.id}
                            onClick={() => setSelectedUser(user)}
                            className="bg-white rounded-2xl shadow p-6 hover:shadow-md transition flex justify-between items-start gap-4 cursor-pointer"
                          >
                            <div>
                              <img
                                src={user.photo}
                                alt={user.displayName}
                                style={{ width: 48, height: 48, borderRadius: "50%" }}
                              />
                              <h4 className="text-lg font-semibold text-gray-900 mb-1">
                                {user.displayName}
                              </h4>
                              <p className="text-gray-600 text-sm">
                                {user.mail || user.userPrincipalName}
                              </p>
                              <p className="text-gray-500 text-xs mt-1 italic">{user.jobTitle}</p>
                              {/* KPI display */}
                              {userKPI && (
                                <div className="mt-2 text-xs text-blue-900">
                                  Attendance: {userKPI.attendance}%<br />
                                  Tardiness: {userKPI.tardiness}%<br />
                                  Utilization: {userKPI.utilizationScore}%
                                </div>
                              )}
                              {/* HR Stats display */}
                              {userHR && (
                                <div className="mt-2 text-xs text-green-900">
                                  Adherence: {userHR.adherence}%<br />
                                  Disciplinary: {userHR.da}%
                                </div>
                              )}
                            </div>
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

      {/* Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-white/95 rounded-2xl shadow-xl p-6 max-w-md w-full relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setSelectedUser(null)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 text-xl"
            >
              ✕
            </button>

            {/* Header */}
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-gray-900">
                {selectedUser.displayName}
              </h3>
              <p className="text-sm text-gray-600">
                {selectedUser.mail || selectedUser.userPrincipalName}
              </p>
              <p className="text-xs text-gray-500 italic">{selectedUser.jobTitle}</p>
            </div>

            {/* Shift/task info */}
            {(() => {
              const email = (selectedUser.mail || selectedUser.userPrincipalName)?.toLowerCase().trim();
              const shift = shiftStats[email] || { shiftHours: 0, usedHours: 0, remaining: 0 };

              return (
                <div className="space-y-2 text-sm text-gray-700">
                  <p>⏱ <strong>Shift Hours:</strong> {shift.shiftHours.toFixed(2)} hrs</p>
                  📋 <strong>Task Duration:</strong> {(selectedUser.taskStats?.totalDuration ?? 0).toFixed(2)} hrs
                  <p className="text-green-600 font-medium">
                    <strong>Remaining:</strong> {shift.remaining.toFixed(2)} hrs
                  </p>
                  <p className="mt-2">
                    ✅ Completed: {selectedUser.taskStats?.completed ?? 0} | ⏳ Pending: {selectedUser.taskStats?.pending ?? 0}
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