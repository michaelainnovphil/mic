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
    presence: 0,
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
  const [showPresenceModal, setShowPresenceModal] = useState(false);

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
        }
      } catch (err) {
        console.error("Failed to fetch users", err);
      } finally {
        setLoading(false);
      }
    }

    fetchUsersAndTasks();
  }, [refreshKey]);

  // fetch daily presence & attendance
  useEffect(() => {
    async function fetchDailyStats() {
      try {
        const res = await fetch("/api/presence");
        const data = await res.json();

        const shiftRes = await fetch("/api/shifts");
        const shiftData = shiftRes.ok ? await shiftRes.json() : { shiftDetailsPerUser: {} };
        const shiftDetailsPerUser = shiftData.shiftDetailsPerUser || {};

        // fetch users here so we can mark "absent" = users who did NOT log in today
        const usersRes = await fetch("/api/users");
        const usersData = usersRes.ok ? await usersRes.json() : { value: [] };
        const validUsers = (usersData.value || []).filter(
          (u) =>
            u.jobTitle &&
            u.jobTitle.trim() !== "" &&
            !u.jobTitle.toLowerCase().includes("chief")
        );

        if (res.ok && data) {
          const grouped = { present: [], tardy: [], absent: [] };

          // build details for users who have presence info
          const detailsWithAttendance = (data.details || []).map((u) => {
            const status = (u.status || "absent").toLowerCase();
            let attendanceScore = 50;
            let firstLoginTime = null;

            const userShifts = shiftDetailsPerUser[u.email?.toLowerCase()] || [];
            const latestShift = userShifts[userShifts.length - 1];
            const clockInTime = latestShift?.clockIn || null;

            if (u.firstLogin || clockInTime) {
              firstLoginTime = new Date(u.firstLogin || clockInTime);
              const cutoff = new Date(firstLoginTime);
              cutoff.setHours(8, 30, 0, 0);

              if (firstLoginTime <= cutoff) {
                attendanceScore = 100;
              } else {
                const diffMins = Math.floor((firstLoginTime - cutoff) / 60000);
                if (diffMins <= 5) attendanceScore = 95;
                else if (diffMins <= 10) attendanceScore = 90;
                else if (diffMins <= 15) attendanceScore = 85;
                else attendanceScore = 50;
              }
            }

            let finalStatus = status;
            const today = new Date();
today.setHours(0, 0, 0, 0);

if (!clockInTime) {
  // no clock-in today → absent
  finalStatus = "absent";
} else {
  const clockInDate = new Date(clockInTime);
  const sameDay =
    clockInDate.getFullYear() === today.getFullYear() &&
    clockInDate.getMonth() === today.getMonth() &&
    clockInDate.getDate() === today.getDate();

  if (!sameDay) {
    finalStatus = "absent";
  } else {
    const cutoff = new Date();
    cutoff.setHours(8, 31, 0, 0);
    finalStatus = firstLoginTime <= cutoff ? "present" : "tardy";
  }
}

            const emailLower = (u.email || u.mail || u.userPrincipalName || "").toLowerCase();
            const userId = u.userId || u.id || emailLower;

            if (finalStatus === "present") grouped.present.push({ ...u, attendanceScore, firstLoginTime, userId, email: emailLower });
            else if (finalStatus === "tardy") grouped.tardy.push({ ...u, attendanceScore, firstLoginTime, userId, email: emailLower });
            else grouped.absent.push({ ...u, attendanceScore, firstLoginTime, userId, email: emailLower });

            return { ...u, attendanceScore, firstLoginTime, status: finalStatus, userId, email: emailLower };
          });

          // build a set of emails that did log in / have presence entries today
          const presentEmails = new Set(
            (detailsWithAttendance || [])
              .map((d) => (d.email || d.userPrincipalName || d.mail || "").toLowerCase())
              .filter(Boolean)
          );

          // For valid users that are NOT in presentEmails, mark them as absent (didn't log in today)
          validUsers.forEach((user) => {
            const email = (user.mail || user.userPrincipalName || "").toLowerCase();
            if (!email) return; 
            if (!presentEmails.has(email)) {
              grouped.absent.push({
                userId: user.id,
                name: user.displayName || email,
                email,
                attendanceScore: 0,
                firstLoginTime: null,
                status: "absent",
              });
            }
          });

          // total users should be the count of valid users (those we care about)
          const totalUsers = validUsers.length || 1;
          const presentCount = grouped.present.length + grouped.tardy.length;
          const presencePercent = Math.round((presentCount / totalUsers) * 100);

          const attendancePercent = Math.round(((grouped.present.length + grouped.tardy.length) / totalUsers) * 100);

          const tardinessPercent =
            Math.round(((presentCount - grouped.tardy.length) / presentCount) * 100);


          setDailyStats({
            presence: presencePercent,
            attendance: attendancePercent,
            tardiness: tardinessPercent,
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

  // build pieData
  const buildPieData = () => {
    if (!selectedUser) {
      return [
        { name: "Presence", value: Math.round(dailyStats.presence) },
        { name: "Attendance", value: Math.round(dailyStats.attendance) }, // ✅ updated chart
        { name: "Tardiness", value: Math.round(dailyStats.tardiness) },
        { name: "Adherence", value: 92 },
        { name: "Disciplinary Action", value: disciplinaryPercent },
      ];
    } else {
      const userDetail =
        [...dailyStats.details.present, ...dailyStats.details.tardy, ...dailyStats.details.absent].find(
          (u) => u.userId === selectedUser.id
        );

      const presenceVal = userDetail ? 100 : 0;
      const attendanceVal = userDetail ? 100 : 0; 
      const isTardy = dailyStats.details.tardy.some((u) => u.userId === selectedUser.id);
      const tardinessVal = isTardy ? 50 : 100;

      const adherenceVal = 92;
      const hasDA = disciplinaryRecords[selectedUser.id]?.length > 0;
      const daVal = hasDA ? 0 : 100;

      return [
        { name: "Presence", value: presenceVal },
        { name: "Attendance", value: attendanceVal },
        { name: "Tardiness", value: tardinessVal },
        { name: "Adherence", value: adherenceVal },
        { name: "Disciplinary Action", value: daVal },
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
                  if (item.name === "Presence") setShowPresenceModal(true);
                  if (item.name === "Attendance") setShowAttendanceModal(true);
                  if (item.name === "Tardiness") setShowTardinessModal(true);
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
                  <div className="border border-[#0a1f8f] rounded-lg">
                    <Disclosure.Button className="flex justify-between w-full px-4 py-2 text-left text-sm font-medium bg-gray-100 rounded-lg hover:bg-gray-200">
                      <span>{dept}</span>
                      <ChevronUpIcon
                        className={`${open ? "rotate-180 transform" : ""} w-5 h-5 text-gray-500`}
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

        {/* Presence Modal */}
        <Dialog
          open={showPresenceModal}
          onClose={() => setShowPresenceModal(false)}
          className="relative z-50"
        >
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-xl w-full">
              <Dialog.Title className="text-lg font-semibold">
                Presence Details
              </Dialog.Title>
              <p className="mt-2 text-sm text-gray-600">
                {dailyStats.presence}% online
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
                  onClick={() => setShowPresenceModal(false)}
                  className="rounded-md bg-blue-900 px-4 py-2 text-white hover:bg-blue-800"
                >
                  Close
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>

        {/* Attendance Modal */}
        <Dialog
          open={showAttendanceModal}
          onClose={() => setShowAttendanceModal(false)}
          className="relative z-50"
        >
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-xl w-full">
              <Dialog.Title className="text-lg font-semibold">
                Attendance
              </Dialog.Title>

              <div className="mt-4 space-y-4 max-h-80 overflow-y-auto">
                {/* Present Employees */}
                {dailyStats.details.present?.length > 0 ? (
                  <div>
                    <h4 className="font-medium text-green-600 mb-2">
                      Present ({dailyStats.details.present.length})
                    </h4>
                    <ul className="space-y-1">
                      {dailyStats.details.present.map((u) => (
                        <li
                          key={u.userId}
                          className="flex justify-between text-sm p-2 rounded bg-green-50 border border-green-200"
                        >
                          <span>{u.name}</span>
                          <span className="italic text-green-700">Present</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No present employees</p>
                )}

                {/* Absent Employees */}
                {dailyStats.details.absent?.length > 0 ? (
                  <div>
                    <h4 className="font-medium text-red-600 mb-2">
                      Absent ({dailyStats.details.absent.length})
                    </h4>
                    <ul className="space-y-1">
                      {dailyStats.details.absent.map((u) => (
                        <li
                          key={u.userId}
                          className="flex justify-between text-sm p-2 rounded bg-red-50 border border-red-200"
                        >
                          <span>{u.name}</span>
                          <span className="italic text-red-700">Absent</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No absent employees</p>
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
            <Dialog.Panel className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-xl w-full">
              <Dialog.Title className="text-lg font-semibold">
                Tardiness
              </Dialog.Title>

              {dailyStats.details.tardy?.length > 0 ? (
                <ul className="mt-4 space-y-2 max-h-80 overflow-y-auto">
                  {dailyStats.details.tardy.map((u) => (
                    <li
                      key={u.userId}
                      className="flex flex-col text-sm p-3 rounded bg-yellow-50 border border-yellow-200"
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">{u.name}</span>
                        <span className="italic text-yellow-700">Tardy</span>
                      </div>
                      <div className="mt-1 text-gray-600">
                        First login: {" "}
                        <span className="font-mono">
                          {u.firstLogin
                            ? new Date(u.firstLogin).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "N/A"}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-gray-500">No tardy employees</p>
              )}

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

        {/* Disciplinary Modal */}
        <Dialog
          open={showDAModal}
          onClose={() => setShowDAModal(false)}
          className="relative z-50"
        >
          <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-xl w-full">
              <Dialog.Title className="text-lg font-semibold">
                Disciplinary Action
              </Dialog.Title>
              {selectedUser && (
                <p className="mt-2 text-sm text-gray-600">
                  For {selectedUser.name}
                </p>
              )}
              {selectedUser && disciplinaryRecords[selectedUser.id]?.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
                  {disciplinaryRecords[selectedUser.id].map((d, idx) => (
                    <li key={idx}>{d}</li>
                  ))}
                </ul>
              )}

              <input
                type="text"
                value={newDA}
                onChange={(e) => setNewDA(e.target.value)}
                placeholder="Enter action"
                className="mt-4 w-full rounded border px-3 py-2"
              />

              <div className="mt-4 flex justify-end space-x-2">
                <button
                  onClick={() => setShowDAModal(false)}
                  className="rounded-md bg-gray-300 px-4 py-2 hover:bg-gray-400"
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
