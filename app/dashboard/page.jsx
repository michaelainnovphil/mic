"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";

export default function UserList() {
  const [chiefs, setChiefs] = useState([]);
  const [groupedUsers, setGroupedUsers] = useState({});
  const [shiftStats, setShiftStats] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);

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
          const shiftHours = Number(shiftHoursRaw) || 0;
          const usedHours = Number(taskStats[userId]?.totalDuration) || 0;
          const remaining = shiftHours - usedHours;
          const normalizedEmail = userId.toLowerCase().trim();
          formattedStats[normalizedEmail] = {
            userId: normalizedEmail,
            shiftHours,
            usedHours,
            remaining,
          };
        }
        setShiftStats(formattedStats);

        // Handle user grouping
        const usersJson = await usersRes.json();
        const chiefsList = [];
        const groups = {};

        usersJson.value.forEach((user) => {
          if (!user.jobTitle || !user.assignedLicenses?.length) return;
          const jobTitle = user.jobTitle;
          const isChief = jobTitle.toLowerCase().includes("chief");
          const userEmail = (user.mail || user.userPrincipalName)?.toLowerCase().trim();
          user.taskStats = taskStats[userEmail] || { completed: 0, pending: 0 };

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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Our Team</h2>

        {chiefs.length > 0 && (
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-blue-900 mb-4">Stakeholders</h3>
            <div className="flex flex-wrap gap-4">
              {chiefs.map((user) => (
                <div
                  key={user.id}
                  onClick={() => setSelectedUser(user)}
                  className="bg-white rounded-2xl shadow p-4 w-64 hover:shadow-md transition cursor-pointer"
                >
                  <h4 className="text-lg font-semibold text-gray-900 mb-1">
                    {user.displayName}
                  </h4>
                  <p className="text-gray-600 text-sm">
                    {user.mail || user.userPrincipalName}
                  </p>
                  <p className="text-gray-500 text-xs mt-1 italic">{user.jobTitle}</p>
                </div>
              ))}
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
                      {users.slice(i * 2, i * 2 + 2).map((user) => (
                        <div
                          key={user.id}
                          onClick={() => setSelectedUser(user)}
                          className="bg-white rounded-2xl shadow p-6 hover:shadow-md transition flex justify-between items-start gap-4 cursor-pointer"
                        >
                          <div>
                            <h4 className="text-lg font-semibold text-gray-900 mb-1">
                              {user.displayName}
                            </h4>
                            <p className="text-gray-600 text-sm">
                              {user.mail || user.userPrincipalName}
                            </p>
                            <p className="text-gray-500 text-xs mt-1 italic">{user.jobTitle}</p>
                          </div>
                        </div>
                      ))}
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
        const stats = shiftStats[email] || { shiftHours: 0, usedHours: 0, remaining: 0 };
        return (
          <div className="space-y-2 text-sm text-gray-700">
            <p>⏱ <strong>Shift Hours:</strong> {stats.shiftHours.toFixed(2)} hrs</p>
            <p>📋<strong>Task Duration:</strong> {stats.usedHours.toFixed(2)} hrs</p>
            <p className="text-green-600 font-medium">
              <strong>Remaining:</strong> {stats.remaining.toFixed(2)} hrs
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
