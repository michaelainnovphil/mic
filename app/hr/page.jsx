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

const allowedUsers = [
  "mdbarreda@innovphil.com",
  "smbernardo@innovphil.com",
  "carce@innovphil.com",
  "aarce@innovphil.com",
  "jlolfindo@innovphil.com",
];

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
  const [showAdherenceModal, setShowAdherenceModal] = useState(false);


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

      // fetch all users to ensure absent users are included
      const usersRes = await fetch("/api/users");
      const usersData = usersRes.ok ? await usersRes.json() : { value: [] };
      const validUsers = (usersData.value || []).filter(
        (u) =>
          u.jobTitle &&
          u.jobTitle.trim() !== "" &&
          !u.jobTitle.toLowerCase().includes("chief")
      );

      if (res.ok && data) {
        const grouped = { present: [], tardy: [], absent: [], restDay: [], leave: [] };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // details from presence + shifts
        const detailsWithAttendance = (data.details || []).map((u) => {
          const emailLower = (u.email || u.mail || u.userPrincipalName || "").toLowerCase();
          const userId = u.userId || u.id || emailLower;

          const userShifts = shiftDetailsPerUser[emailLower] || [];
          const latestShift = userShifts[userShifts.length - 1];
          // detect rest day or leave
          const isRestDay =
            latestShift?.shiftType?.toLowerCase() === "rest day" ||
            latestShift?.isRestDay === true ||
            (latestShift?.startDateTime &&
              new Date(latestShift.startDateTime).toString().toLowerCase().includes("sun"));

          const isLeave =
            latestShift?.shiftType?.toLowerCase() === "leave" ||
            latestShift?.isLeave === true ||
            latestShift?.notes?.toLowerCase()?.includes("leave");

          const clockInTime = latestShift?.clockIn || null;
          const breakMinutes = latestShift?.breakMinutes ?? 0;


          // use either presence firstLogin OR shift clockIn
          const firstLoginTime = u.firstLogin
            ? new Date(u.firstLogin)
            : clockInTime
            ? new Date(clockInTime)
            : null;

          let attendanceScore = 50;
          let finalStatus = "absent";

          if (firstLoginTime) {
  // cutoff for today 8:30 AM
  const cutoff = new Date();
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

  const sameDay =
    firstLoginTime.getFullYear() === today.getFullYear() &&
    firstLoginTime.getMonth() === today.getMonth() &&
    firstLoginTime.getDate() === today.getDate();

  if (sameDay) {
    const cutoffStatus = new Date();
    cutoffStatus.setHours(8, 31, 0, 0);
    finalStatus = firstLoginTime <= cutoffStatus ? "present" : "tardy";
  }
}


          const detail = {
            ...u,
            attendanceScore,
            firstLoginTime,
            status: finalStatus,
            userId,
            email: emailLower,
            breakMinutes,
          };

          // classify rest day and leave before pushing to present/tardy/absent
if (isRestDay) {
  grouped.restDay.push({
    ...u,
    status: "restDay",
    attendanceScore: 100,
    firstLoginTime: null,
  });
  return detail;
}

if (isLeave) {
  grouped.leave.push({
    ...u,
    status: "leave",
    attendanceScore: 100,
    firstLoginTime: null,
  });
  return detail;
}


          if (finalStatus === "present") grouped.present.push(detail);
          else if (finalStatus === "tardy") grouped.tardy.push(detail);
          else grouped.absent.push(detail);

          return detail;
        });

        // track who already has presence/shift data
        const presentEmails = new Set(
          detailsWithAttendance.map((d) => d.email).filter(Boolean)
        );

        // ensure all valid users are included
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
              breakMinutes: 0,
            });
          }
        });

        const totalUsers = grouped.present.length + grouped.tardy.length + grouped.absent.length;
        const presentCount = grouped.present.length + grouped.tardy.length;

        const attendancePercent = totalUsers > 0 ? Math.round((presentCount / totalUsers) * 100) : 0;
        const tardinessPercent = presentCount > 0
          ? Math.round(((presentCount - grouped.tardy.length) / presentCount) * 100)
          : 0;

        let adherenceSum = 0;
        let adherenceUsers = 0;
        [...grouped.present, ...grouped.tardy].forEach((u) => {
          adherenceUsers++;
          adherenceSum += u.breakMinutes > 75 ? 50 : 100;
        });

        const adherencePercent = adherenceUsers > 0
          ? Math.round(adherenceSum / adherenceUsers)
          : 0;

        setDailyStats({
          presence: attendancePercent,
          attendance: attendancePercent,
          tardiness: tardinessPercent,
          adherence: adherencePercent,
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
      { name: "Attendance", value: Math.round(dailyStats.attendance || 100) }, 
      { name: "Tardiness", value: Math.round(dailyStats.tardiness || 100) },
      { name: "Adherence", value: Math.round(dailyStats.adherence || 100) },
      { name: "Disciplinary Action", value: disciplinaryPercent },
    ];
  } else {
    const userDetail =
      [...dailyStats.details.present, ...dailyStats.details.tardy, ...dailyStats.details.absent].find(
        (u) => u.userId === selectedUser.id
      );

    const attendanceVal = userDetail ? 100 : 0; 
    const isTardy = dailyStats.details.tardy.some((u) => u.userId === selectedUser.id);
    const tardinessVal = isTardy ? 50 : 100;

    
    let adherenceVal = 100;
    if (userDetail) {
      adherenceVal = userDetail.breakMinutes > 75 ? 50 : 100;
    }

    const hasDA = disciplinaryRecords[selectedUser.id]?.length > 0;
    const daVal = hasDA ? 0 : 100;

    return [
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


// Refresh DA from backend
const refreshDA = async () => {
  try {
    const res = await fetch("/api/disciplinary");
    if (!res.ok) throw new Error("Failed to fetch");
    const data = await res.json();
    setDisciplinaryRecords(data || {});
  } catch (err) {
    console.error("refreshDA error", err);
  }
};

const handleDeleteDA = async (id) => {
  if (!id) return;
  const ok = window.confirm("Remove this disciplinary action?");
  if (!ok) return;

  try {
    const res = await fetch("/api/disciplinary", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) throw new Error("Delete failed " + res.status);

    await refreshDA(); // refetch DAs after delete
  } catch (err) {
    console.error("handleDeleteDA error", err);
    alert("Failed to delete disciplinary action — please try again.");
  }
};





  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-[90%] mx-auto p-6 space-y-10">
        {/* Daily Averages Pie */}
        <div className="bg-white shadow rounded-2xl p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-semibold">
              {selectedUser
                ? `${selectedUser.name}'s Stats`
                : "Daily Average For Naga/Makati"}
            </h2>

            {selectedUser && (
              <button
                onClick={() => setSelectedUser(null)}
                className="ml-4 rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300"
              >
                Reset
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {pieData.map((item) => (
              <div
                key={item.name}
                className="flex flex-col items-center cursor-pointer group"
                onClick={() => {
                  if (item.name === "Attendance") setShowAttendanceModal(true);
                  if (item.name === "Tardiness") setShowTardinessModal(true);
                  if (item.name === "Adherence") setShowAdherenceModal(true);
                  if (item.name === "Disciplinary Action") setShowDAModal(true);
                }}
              >
                <div className="relative w-28 h-28 transition-transform duration-200 group-hover:scale-105">
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
                        <Cell fill="#0a1f8f" />
                        <Cell fill="#E5E7EB" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <span className="absolute inset-0 flex items-center justify-center text-base font-bold text-gray-700">
                    {item.value}%
                  </span>
                </div>
                <span className="mt-3 text-sm font-medium text-gray-700">
                  {item.name}
                </span>
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
                                {disciplinaryRecords[u.id].map((d) => (
                                  <li key={d._id}>{d.action}</li>
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
    <Dialog.Panel className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-xl w-full">
      <Dialog.Title className="text-lg font-semibold text-gray-800">
        Attendance
      </Dialog.Title>

      <div className="mt-4 space-y-4 max-h-80 overflow-y-auto">
        {/* Present + Tardy Employees */}
        {[...dailyStats.details.present, ...dailyStats.details.tardy].length > 0 ? (
          <div>
            <h4 className="font-medium text-green-600 mb-2">
              Present (
              {dailyStats.details.present.length + dailyStats.details.tardy.length}
              )
            </h4>
            <ul className="space-y-1">
              {[...dailyStats.details.present, ...dailyStats.details.tardy].map((u) => (
                <li
                  key={u.userId}
                  className="flex justify-between items-center text-sm p-2 rounded-lg bg-green-50 border border-green-200"
                >
                  <span className="font-medium text-gray-700">{u.name}</span>
                  <span
                    className={
                      dailyStats.details.tardy.some((t) => t.userId === u.userId)
                        ? "italic text-yellow-600"
                        : "italic text-green-700"
                    }
                  >
                    {dailyStats.details.tardy.some((t) => t.userId === u.userId)
                      ? "Tardy"
                      : "Present"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No present employees</p>
        )}

        {/* Rest Day Employees */}
{dailyStats.details.restDay?.length > 0 && (
  <div>
    <h4 className="font-medium text-blue-600 mb-2">
      Rest Day ({dailyStats.details.restDay.length})
    </h4>
    <ul className="space-y-1">
      {dailyStats.details.restDay.map((u) => (
        <li
          key={u.userId}
          className="flex justify-between items-center text-sm p-2 rounded-lg bg-blue-50 border border-blue-200"
        >
          <span className="font-medium text-gray-700">{u.name}</span>
          <span className="italic text-blue-700">Rest Day</span>
        </li>
      ))}
    </ul>
  </div>
)}

{/* Leave Employees */}
{dailyStats.details.leave?.length > 0 && (
  <div>
    <h4 className="font-medium text-purple-600 mb-2">
      On Leave ({dailyStats.details.leave.length})
    </h4>
    <ul className="space-y-1">
      {dailyStats.details.leave.map((u) => (
        <li
          key={u.userId}
          className="flex justify-between items-center text-sm p-2 rounded-lg bg-purple-50 border border-purple-200"
        >
          <span className="font-medium text-gray-700">{u.name}</span>
          <span className="italic text-purple-700">On Leave</span>
        </li>
      ))}
    </ul>
  </div>
)}

        {/* Absent Employees */}
        {dailyStats.details.absent?.length > 0 && (
          <div>
            <h4 className="font-medium text-red-600 mb-2">
              Absent ({dailyStats.details.absent.length})
            </h4>
            <ul className="space-y-1">
              {dailyStats.details.absent.map((u) => (
                <li
                  key={u.userId}
                  className="flex justify-between items-center text-sm p-2 rounded-lg bg-red-50 border border-red-200"
                >
                  <span className="font-medium text-gray-700">{u.name}</span>
                  <span className="italic text-red-700">Absent</span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
  First login:{" "}
  <span className="font-mono">
    {u.firstLoginTime
      ? new Date(u.firstLoginTime).toLocaleTimeString([], {
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

        {/* Adherence Modal */}
<Dialog
  open={showAdherenceModal}
  onClose={() => setShowAdherenceModal(false)}
  className="relative z-50"
>
  <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
  <div className="fixed inset-0 flex items-center justify-center p-4">
    <Dialog.Panel className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-xl w-full">
      <Dialog.Title className="text-lg font-semibold">
        Adherence
      </Dialog.Title>

      {([...dailyStats.details.present, ...dailyStats.details.tardy].filter(
        (u) => u.breakMinutes > 75
      ).length > 0) ? (
        <ul className="mt-4 space-y-2 max-h-80 overflow-y-auto">
          {[...dailyStats.details.present, ...dailyStats.details.tardy]
            .filter((u) => u.breakMinutes > 75)
            .map((u) => (
              <li
                key={u.userId}
                className="flex flex-col text-sm p-3 rounded bg-red-50 border border-red-200"
              >
                <div className="flex justify-between">
                  <span className="font-medium">{u.name}</span>
                  <span className="italic text-red-700">
                    Exceeded Break
                  </span>
                </div>
                <div className="mt-1 text-gray-600">
                  Break Time: <span className="font-mono">{u.breakMinutes} min</span>
                </div>
              </li>
            ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-500">
          No employees exceeded the break limit
        </p>
      )}

      <div className="mt-4 flex justify-end">
        <button
          onClick={() => setShowAdherenceModal(false)}
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
  {/* Overlay */}
  <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-hidden="true" />

  {/* Modal Panel */}
  <div className="fixed inset-0 flex items-center justify-center p-4">
    <Dialog.Panel className="mx-auto max-w-lg w-full rounded-2xl bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <Dialog.Title className="text-lg font-semibold text-gray-800">
          Disciplinary Action
        </Dialog.Title>
        <button
          onClick={() => setShowDAModal(false)}
          className="text-gray-400 hover:text-gray-600 transition"
        >
          ✕
        </button>
      </div>

      {/* Body */}
      <div className="p-6 max-h-96 overflow-y-auto">
        {selectedUser ? (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Actions for <span className="font-medium text-gray-800">{selectedUser.name}</span>
            </p>

            {disciplinaryRecords[selectedUser.id]?.length > 0 ? (
              <ul className="space-y-2">
                {disciplinaryRecords[selectedUser.id].map((d) => (
                  <li
                    key={d._id}
                    className="flex justify-between items-center rounded-xl bg-gray-50 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition"
                  >
                    <span>{d.action}</span>
                    <button
                      onClick={() => handleDeleteDA(d._id)}
                      className="text-red-500 hover:text-red-600 text-xs font-medium"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400 italic">No records yet</p>
            )}
          </>
        ) : (
          /* All employees with DA */
          <div className="space-y-4">
            {Object.entries(disciplinaryRecords).length > 0 ? (
              Object.entries(disciplinaryRecords).map(([userId, actions]) => (
                <div
                  key={userId}
                  className="rounded-xl bg-gray-50 p-4 shadow-sm"
                >
                  <p className="font-medium text-gray-800 mb-2">
                    {users.find((u) => u.id === userId)?.name || userId}
                  </p>
                  <ul className="space-y-1 text-sm text-gray-600">
                    {actions.map((d) => (
                      <li
                        key={d._id}
                        className="flex justify-between items-center bg-white rounded-lg px-3 py-2 hover:bg-gray-50 transition"
                      >
                        <span>{d.action}</span>
                        <button
                          onClick={() => handleDeleteDA(d._id)}
                          className="text-red-500 hover:text-red-600 text-xs font-medium"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400 italic">No disciplinary actions recorded</p>
            )}
          </div>
        )}
      </div>

      {/* Footer (Add New DA) */}
      {selectedUser && (
        <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 flex gap-2">
          <input
            type="text"
            value={newDA}
            onChange={(e) => setNewDA(e.target.value)}
            placeholder="Enter new action"
            className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
          <button
            onClick={handleAddDA}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 transition"
          >
            Add
          </button>
        </div>
      )}
    </Dialog.Panel>
  </div>
</Dialog>






      </div>
    </div>
  );
}
