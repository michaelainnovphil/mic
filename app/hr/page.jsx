// app/overview/page.jsx
"use client";

import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
} from "recharts";
import Header from "@/components/Header";
import { Dialog, Disclosure } from "@headlessui/react";
import { ChevronUpIcon } from "lucide-react";
import { TEAM_MAP } from "@/lib/teamMap";

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
  const [showDAModal, setShowDAModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [disciplinaryRecords, setDisciplinaryRecords] = useState({});
  const [newDA, setNewDA] = useState("");
  const [onTimeCompletion, setOnTimeCompletion] = useState(0);

  // fetch users and tasks
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
            else if (typeof task.assignedTo === "string" && task.assignedTo.trim() !== "")
              assigned = [task.assignedTo];
            else assigned = ["unassigned"];

            assigned.forEach((who) => bump(who, isCompleted));
          });

          const usersWithTasks = validUsers.map((u) => {
            const emailKey = (u.mail || u.userPrincipalName || "").toLowerCase();
            const nameKey = (u.displayName || "").toLowerCase();

            const stat =
              statsByKey[emailKey] || statsByKey[nameKey] || { total: 0, completed: 0 };
            const completed = stat.completed || 0;
            const total = stat.total || 0;
            const percentage = total > 0 ? (completed / total) * 100 : 0;

            return {
              id: u.id,
              name: u.displayName || u.mail || u.userPrincipalName || "Unknown",
              email: u.mail || u.userPrincipalName || null,
              completed,
              total,
              percentage,
              photo: u.photo,
              jobTitle: u.jobTitle,
              hasLicense:
                Array.isArray(u.assignedLicenses) && u.assignedLicenses.length > 0,
            };
          });

          setUsers(usersWithTasks);

          const totalCompleted = usersWithTasks.reduce((sum, u) => sum + u.completed, 0);
          const totalTasks = usersWithTasks.reduce((sum, u) => sum + u.total, 0);
          const overallCompletion =
            totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

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

  // fetch daily attendance
  useEffect(() => {
    async function fetchDailyStats() {
      try {
        const res = await fetch("/api/presence");
        const data = await res.json();

        if (res.ok && data) {
          const grouped = { present: [], tardy: [], absent: [] };
          (data.details || []).forEach((u) => {
            const state = (u.status || "absent").toLowerCase();
            if (state === "present") grouped.present.push(u);
            else if (state === "tardy") grouped.tardy.push(u);
            else grouped.absent.push(u);
          });

          setDailyStats({
            attendance: Math.round(data.percent || 0),
            tardiness: Math.round(((data.tardy || 0) / (data.present || 1)) * 100),
            details: grouped,
          });
        }
      } catch (err) {
        console.error("Failed to fetch daily stats", err);
      }
    }

    fetchDailyStats();
  }, []);

  // fetch disciplinary actions
  useEffect(() => {
    async function fetchDA() {
      try {
        const res = await fetch("/api/disciplinary");
        if (res.ok) {
          const data = await res.json();
          setDisciplinaryRecords(data);
        }
      } catch (err) {
        console.error("Failed to fetch DA", err);
      }
    }
    fetchDA();
  }, []);

  // compute DA percentage (overall)
  const totalUsers = users.length;
  const usersWithDA = Object.keys(disciplinaryRecords).length;
  const disciplinaryPercent =
    totalUsers > 0 ? Math.round(((totalUsers - usersWithDA) / totalUsers) * 100) : 100;

  // build pieData (switches based on selectedUser)
  const buildPieData = () => {
    if (!selectedUser) {
      // overall
      return [
        { name: "Attendance", value: Math.round(dailyStats.attendance) },
        { name: "Tardiness", value: Math.round(dailyStats.tardiness) },
        { name: "Adherence", value: 92 },
        { name: "Disciplinary Action", value: disciplinaryPercent },
        { name: "On-Time Completion", value: onTimeCompletion },
      ];
    } else {
      // per user
      const isPresent = dailyStats.details.present.some((u) => u.userId === selectedUser.id);
      const isTardy = dailyStats.details.tardy.some((u) => u.userId === selectedUser.id);
      const attendanceVal = isPresent || isTardy ? 100 : 0;
      const tardinessVal = isTardy ? 0 : 100;
      const adherenceVal = 92; // placeholder (could compute real adherence per-user)
      const hasDA = disciplinaryRecords[selectedUser.id]?.length > 0;
      const daVal = hasDA ? 0 : 100;
      const completionVal = Math.round(selectedUser.percentage);

      return [
        { name: "Attendance", value: attendanceVal },
        { name: "Tardiness", value: tardinessVal },
        { name: "Adherence", value: adherenceVal },
        { name: "Disciplinary Action", value: daVal },
        { name: "On-Time Completion", value: completionVal },
      ];
    }
  };

  const pieData = buildPieData();

  const handleAddDA = async () => {
    if (!selectedUser || !newDA.trim()) return;
    try {
      const res = await fetch("/api/disciplinary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, action: newDA.trim() }),
      });
      if (res.ok) {
        setDisciplinaryRecords((prev) => {
          const existing = prev[selectedUser.id] || [];
          return { ...prev, [selectedUser.id]: [...existing, newDA.trim()] };
        });
        setNewDA("");
        setShowDAModal(false);
      }
    } catch (err) {
      console.error("Error saving DA", err);
    }
  };

  // group users by department
  const groupedByDept = {};
  users.forEach((u) => {
    const dept = TEAM_MAP[u.email?.toLowerCase()] || "Other";
    if (!groupedByDept[dept]) groupedByDept[dept] = [];
    groupedByDept[dept].push(u);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-[90%] mx-auto p-6 space-y-10">
        {/* Daily Averages Pie */}
        <div className="bg-white shadow rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-6">
            {selectedUser ? `${selectedUser.name}'s Stats` : "Daily Average For Naga/Makati"}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {pieData.map((item) => (
              <div
                key={item.name}
                className="flex flex-col items-center cursor-pointer"
                onClick={() => {
                  if (item.name === "Attendance") setShowAttendanceModal(true);
                  if (item.name === "Tardiness") setShowTardinessModal(true);
                  if (item.name === "On-Time Completion") setShowOnTimeModal(true);
                  if (item.name === "Disciplinary Action") setShowDAModal(true);
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

        {/* Department Dropdowns */}
        <div className="bg-white shadow rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">Departments</h2>
          <div className="space-y-4">
            {Object.entries(groupedByDept).map(([dept, members]) => (
              <Disclosure key={dept}>
                {({ open }) => (
                  <div className="border rounded-lg">
                    <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-left text-sm font-medium bg-gray-100 rounded-lg hover:bg-gray-200">
                      <span>{dept}</span>
                      <ChevronUpIcon
                        className={`${
                          open ? "rotate-180 transform" : ""
                        } w-5 h-5 text-gray-500`}
                      />
                    </Disclosure.Button>
                    <Disclosure.Panel className="px-4 pb-4">
                      <ul className="space-y-2 mt-2">
                        {members.map((u) => (
                          <li
                            key={u.id}
                            className="flex justify-between items-center text-sm p-2 rounded bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => setSelectedUser(u)}
                          >
                            <div>
                              <span className="font-medium">{u.name}</span>
                              <span className="ml-2 text-gray-500 text-xs">
                                {Math.round(u.percentage)}% tasks
                              </span>
                              {disciplinaryRecords[u.id] && (
                                <ul className="ml-4 list-disc text-gray-600">
                                  {disciplinaryRecords[u.id].map((d, idx) => (
                                    <li key={idx}>{d}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedUser(u);
                                setShowDAModal(true);
                              }}
                              className="ml-4 rounded-md bg-blue-900 px-3 py-1 text-white hover:bg-blue-500"
                            >
                              Add DA
                            </button>
                          </li>
                        ))}
                      </ul>
                    </Disclosure.Panel>
                  </div>
                )}
              </Disclosure>
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

        {/* On-Time Completion Modal */}
        <Dialog
          open={showOnTimeModal}
          onClose={() => setShowOnTimeModal(false)}
          className="relative z-50"
        >
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-xl w-full">
              <Dialog.Title className="text-lg font-semibold">
                On-Time Completion Details
              </Dialog.Title>
              <p className="mt-2 text-sm text-gray-600">
                {onTimeCompletion}% of tasks completed on time
              </p>

              <div className="mt-4 space-y-4 max-h-80 overflow-y-auto">
                <ul className="space-y-1">
                  {users.map((u) => (
                    <li
                      key={u.id}
                      className="flex justify-between text-sm p-2 rounded bg-gray-100"
                    >
                      <span>{u.name}</span>
                      <span className="italic">{Math.round(u.percentage)}%</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowOnTimeModal(false)}
                  className="rounded-md bg-blue-900 px-4 py-2 text-white hover:bg-blue-800"
                >
                  Close
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>

        {/* Disciplinary Action Modal */}
        <Dialog
          open={showDAModal}
          onClose={() => setShowDAModal(false)}
          className="relative z-50"
        >
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-xl w-full">
              <Dialog.Title className="text-lg font-semibold">
                Add Disciplinary Action
              </Dialog.Title>
              <p className="mt-2 text-sm text-gray-600">
                {selectedUser ? selectedUser.name : "Select a user first"}
              </p>

              <input
                type="text"
                value={newDA}
                onChange={(e) => setNewDA(e.target.value)}
                placeholder="Enter action"
                className="mt-4 w-full border rounded-md p-2"
              />

              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={() => setShowDAModal(false)}
                  className="rounded-md bg-gray-200 px-4 py-2 hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddDA}
                  className="rounded-md bg-blue-900 px-4 py-2 text-white hover:bg-blue-800"
                >
                  Save
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </div>
    </div>
  );
}
