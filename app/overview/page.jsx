"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Image from "next/image";
import Header from "@/components/Header";
import { Dialog } from "@headlessui/react";

export default function OverviewPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dailyStats, setDailyStats] = useState({
    attendance: 0,
    tardiness: 0,
    details: { present: [], tardy: [], absent: [] },
  });
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showTardinessModal, setShowTardinessModal] = useState(false);
  const [showOnTimeModal, setShowOnTimeModal] = useState(false);
  const [onTimeCompletion, setOnTimeCompletion] = useState(0);

  // fetch users and tasks (monthly stats)
  useEffect(() => {
    async function fetchUsersAndTasks() {
      try {
        const res = await fetch("/api/users");
        const data = await res.json();

        const tasksRes = await fetch("/api/tasks");
        const allTasks = tasksRes.ok ? await tasksRes.json() : [];

        if (res.ok && data.value) {
          const validUsers = data.value.filter(
            (u) =>
              u.jobTitle &&
              u.jobTitle.trim() !== "" &&
              !u.jobTitle.toLowerCase().includes("chief")
          );

          const statsByKey = {};
          const bump = (key, isCompleted) => {
            const k = (key || "unassigned").toString().trim().toLowerCase();
            if (!statsByKey[k]) statsByKey[k] = { total: 0, completed: 0 };
            statsByKey[k].total += 1;
            if (isCompleted) statsByKey[k].completed += 1;
          };

          (allTasks || []).forEach((task) => {
            const isCompleted = task.status === "completed";
            let assigned = [];
            if (Array.isArray(task.assignedTo)) assigned = task.assignedTo;
            else if (
              typeof task.assignedTo === "string" &&
              task.assignedTo.trim() !== ""
            )
              assigned = [task.assignedTo];
            else assigned = ["unassigned"];

            assigned.forEach((who) => bump(who, isCompleted));
          });

          const usersWithTasks = validUsers.map((u) => {
            const emailKey = (u.mail || u.userPrincipalName || "").toLowerCase();
            const nameKey = (u.displayName || "").toLowerCase();

            const stat =
              statsByKey[emailKey] ||
              statsByKey[nameKey] || { total: 0, completed: 0 };
            const completed = stat.completed || 0;
            const total = stat.total || 0;
            const percentage = total > 0 ? (completed / total) * 100 : 0;

            return {
              id: u.id,
              name:
                u.displayName || u.mail || u.userPrincipalName || "Unknown",
              email: u.mail || u.userPrincipalName || null,
              completed,
              total,
              percentage,
              photo: u.photo,
              jobTitle: u.jobTitle,
              hasLicense:
                Array.isArray(u.assignedLicenses) &&
                u.assignedLicenses.length > 0,
            };
          });

          setUsers(usersWithTasks);

          // ✅ Compute overall completion %
          const totalCompleted = usersWithTasks.reduce(
            (sum, u) => sum + u.completed,
            0
          );
          const totalTasks = usersWithTasks.reduce(
            (sum, u) => sum + u.total,
            0
          );
          const overallCompletion =
            totalTasks > 0
              ? Math.round((totalCompleted / totalTasks) * 100)
              : 0;

          setOnTimeCompletion(overallCompletion);
        }
      } catch (err) {
        console.error("Failed to fetch users", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUsersAndTasks();
  }, [refreshKey]);

  // fetch today's attendance/tardiness
  useEffect(() => {
    async function fetchDailyStats() {
      try {
        const res = await fetch("/api/presence");
        const data = await res.json();

        if (res.ok && data) {
          const grouped = {
            present: [],
            tardy: [],
            absent: [],
          };

          (data.details || []).forEach((u) => {
            const state = (u.status || "absent").toLowerCase();

            if (state === "present") {
              grouped.present.push(u);
            } else if (state === "tardy") {
              grouped.tardy.push(u);
            } else if (state === "absent") {
              grouped.absent.push(u);
            } else {
              grouped.absent.push(u);
            }
          });

          setDailyStats({
            attendance: Math.round(data.percent || 0),
            tardiness: Math.round(
              ((data.tardy || 0) / (data.present || 1)) * 100
            ),
            details: grouped,
          });
        } else {
          console.error("Failed to fetch presence stats", data);
        }
      } catch (err) {
        console.error("Failed to fetch daily stats", err);
      }
    }

    fetchDailyStats();
  }, []);

  const sortedEmployees = [...users].sort(
    (a, b) => b.percentage - a.percentage
  );
  const top3 = sortedEmployees.slice(0, 3);
  const others = sortedEmployees.slice(3);

  const pieData = [
    { name: "Attendance", value: Math.round(dailyStats.attendance) },
    { name: "Tardiness", value: Math.round(dailyStats.tardiness) },
    { name: "Adherence", value: 92 },
    { name: "Disciplinary Action", value: 88 },
    { name: "On-Time Completion", value: onTimeCompletion },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <div className="max-w-[90%] mx-auto p-6 space-y-10">
        {/* Monthly Average */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-6 text-gray-900 dark:text-gray-100">
            Monthly Average For Naga/Makati
          </h2>

          {loading ? (
            <p className="text-gray-700 dark:text-gray-200">Loading users...</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-10">
              {/* Top Performers */}
              <div>
                <h3 className="text-md font-semibold mb-4 text-center text-gray-900 dark:text-gray-100">
                  Top Employees
                </h3>
                <div className="flex justify-center gap-8 mb-8">
                  {top3.map((person, index) => (
                    <div key={person.id} className="flex flex-col items-center">
                      <div
                        className={`w-20 h-20 rounded-full border-4 overflow-hidden ${
                          index === 0
                            ? "border-yellow-400"
                            : index === 1
                            ? "border-gray-400"
                            : "border-orange-400"
                        }`}
                      >
                        {person.photo ? (
                          <Image
                            src={person.photo}
                            alt={person.name}
                            width={80}
                            height={80}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-600">
                            {person.name[0]}
                          </div>
                        )}
                      </div>
                      <span className="mt-2 font-medium text-gray-900 dark:text-gray-100">
                        #{index + 1} {person.name}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Others list */}
                <div className="grid grid-cols-4 gap-6 text-center">
                  {others.map((person, idx) => (
                    <div
                      key={person.id || idx}
                      className="flex flex-col items-center text-gray-500 dark:text-gray-300"
                    >
                      {person.photo ? (
                        <Image
                          src={person.photo}
                          alt={person.name}
                          width={48}
                          height={48}
                          className="rounded-full mb-1"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-200 mb-1 flex items-center justify-center">
                          <span className="text-xs font-semibold text-gray-600">
                            {person.name[0]}
                          </span>
                        </div>
                      )}
                      <span className="text-xs">{person.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bar Chart */}
              <div>
                <h3 className="text-md font-semibold mb-4 text-center text-gray-900 dark:text-gray-100">
                  Tasks per Employee
                </h3>
                <div className="w-full h-150 overflow-y-auto">
                  <ResponsiveContainer width="100%" height={users.length * 40}>
                    <BarChart
                      data={users}
                      layout="vertical"
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis
  dataKey="name"
  type="category"
  width={120}
  tick={
    typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? { fontSize: 12, fill: "#F3F4F6" } // light gray for dark mode
      : { fontSize: 12, fill: "#374151" } // dark gray for light mode
  }
  interval={0}
/>
                      <Tooltip
                        contentStyle={{
                          background: "#1F2937",
                          color: "#F3F4F6",
                          borderRadius: "8px",
                          border: "none",
                        }}
                        labelStyle={{ color: "#F3F4F6" }}
                        wrapperStyle={{ zIndex: 50 }}
                      />
                      <Bar
                        dataKey="percentage"
                        fill="#1E3A8A"
                        radius={[0, 6, 6, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}