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
              // if API returns something unexpected, default to absent
              grouped.absent.push(u);
            }
          });

          setDailyStats({
            attendance: Math.round(data.percent || 0),
            tardiness: Math.round(((data.tardy || 0) / (data.present || 1)) * 100),
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
    { name: "On-Time Completion", value: 91 },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-[90%] mx-auto p-6 space-y-10">
        {/* Daily Average */}
        <div className="bg-white shadow rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-6">
            Daily Average For Naga/Makati
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {pieData.map((item) => (
              <div
                key={item.name}
                className="flex flex-col items-center cursor-pointer"
                onClick={() => {
  if (item.name === "Attendance") setShowAttendanceModal(true);
  if (item.name === "Tardiness") setShowTardinessModal(true);
}}

              >
                <div className="relative w-28 h-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Completed", value: item.value },
                          { name: "Remaining", value: 100 - item.value },
                        ]}
                        innerRadius={40}
                        outerRadius={55}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        <Cell fill="#1EB1D6" />
                        <Cell fill="#E5E7EB" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold">
                    {item.value}%
                  </span>
                </div>
                <span className="mt-3 text-sm font-medium">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance Modal */}
        <Dialog
          open={showAttendanceModal}
          onClose={() => setShowAttendanceModal(false)}
          className="relative z-50"
        >
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-xl w-full">
              <Dialog.Title className="text-lg font-semibold">
                Attendance Details
              </Dialog.Title>
              <p className="mt-2 text-sm text-gray-600">
                {dailyStats.attendance}% present
              </p>

              <div className="mt-4 space-y-4 max-h-80 overflow-y-auto">
                {Object.entries(dailyStats.details).map(([status, members]) =>
                  members.length > 0 ? (
                    <div key={status}>
                      <h4 className="capitalize font-medium text-gray-700 mb-1">
                        {status} ({members.length})
                      </h4>
                      <ul className="space-y-1">
                        {members.map((u) => (
                          <li
                            key={u.userId}
                            className="flex justify-between text-sm p-2 rounded bg-gray-100"
                          >
                            <span>{u.name}</span>
                            <span className="italic">{u.status}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowAttendanceModal(false)}
                  className="rounded-md bg-blue-900 px-4 py-2 text-white hover:bg-blue-800"
                >
                  Close
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>

        {/* Tardiness Modal */}
        <Dialog
          open={showTardinessModal}
          onClose={() => setShowTardinessModal(false)}
          className="relative z-50"
        >
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-xl w-full">
              <Dialog.Title className="text-lg font-semibold">
                Tardiness Details
              </Dialog.Title>
              <p className="mt-2 text-sm text-gray-600">
                Employees who logged in after 8:45
              </p>

              <div className="mt-4 space-y-4 max-h-80 overflow-y-auto">
                {dailyStats.details.tardy.length > 0 ? (
                  <ul className="space-y-1">
                    {dailyStats.details.tardy.map((u) => (
                      <li
                        key={u.userId}
                        className="flex justify-between text-sm p-2 rounded bg-gray-100"
                      >
                        <span>{u.name}</span>
                        <span className="italic text-red-600">
                          {u.firstLogin
                            ? new Date(u.firstLogin).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500">No tardy employees</p>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowTardinessModal(false)}
                  className="rounded-md bg-blue-900 px-4 py-2 text-white hover:bg-blue-800"
                >
                  Close
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>



      </div>
    </div>
  );
}
