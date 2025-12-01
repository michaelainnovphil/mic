// app/hr/page.jsx
"use client";

import { useEffect, useState, useCallback, useMemo } from "react";  // Added useCallback, useMemo
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
import { SessionProvider, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

function OverviewContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Restrict access to HR page (same as assignment page)
  useEffect(() => {
    if (status === "loading") return;

    const allowedUsers = [
      "mdbarreda@innovphil.com",
      "aarce@innovphil.com",
      "carce@innovphil.com",
      "amlinguete@innovphil.com",
      "mcastilla@innovphil.com",
      "mjpanotes@innovphil.com",
      "smbernardo@innovphil.com",
    ];
    if (!session || !allowedUsers.includes(session.user.email)) {
      router.replace("/unauthorized");
    }
  }, [session, status, router]);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dailyStats, setDailyStats] = useState({
    presence: 0,
    attendance: 0,
    tardiness: 0,
    details: { present: [], tardy: [], absent: [], restDay: [], leave: [] },
  });

  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showTardinessModal, setShowTardinessModal] = useState(false);
  const [showOnTimeModal, setShowOnTimeModal] = useState(false);
  const [showDAModal, setShowDAModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [disciplinaryRecords, setDisciplinaryRecords] = useState({});
  const [newDA, setNewDA] = useState("");
  const [showAdherenceModal, setShowAdherenceModal] = useState(false);
  const [period, setPeriod] = useState("daily"); // daily | weekly | monthly
  const [loadingStats, setLoadingStats] = useState(false);  // For stats loading
  const [cachedData, setCachedData] = useState({});  // Cache for fetched data
  const [debouncedPeriod, setDebouncedPeriod] = useState(period);  // Debounced period

  // Debounce period changes (500ms delay to prevent rapid switches)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPeriod(period), 500);
    return () => clearTimeout(timer);
  }, [period]);

  // Compute automatic DA based on attendance stats
  const computeAutoDA = useCallback((userDetail) => {
    if (!userDetail) return 0;

    const { totalTardy, totalPresent, breakMinutes, totalShifts } = userDetail;

    let DA = 0;

    if (totalTardy >= 4) DA += 1;
    if ((userDetail.minutesLate ?? 0) > 120) DA += 1;
    if (totalShifts > 0 && totalTardy + totalPresent === 0) DA += 1;

    return DA;
  }, []);

  function normalizeShifts(newData) {
    const normalized = [];

    Object.entries(newData).forEach(([email, dates]) => {
      Object.entries(dates).forEach(([dateKey, shift]) => {
        normalized.push({
          userId: email,
          date: shift.date,
          start: shift.start,
          end: shift.end,
          note: shift.note,
          type: shift.type, // Present / Absent / TimeOff etc.
          clockIn: shift.clockIn || null,
          clockOut: shift.clockOut || null,
          breakMinutes: shift.breakMinutes || 0,
        });
      });
    });

    return normalized;
  }

  // fetch users and tasks (unchanged, but could be cached if needed)
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

  // Memoized stats computation (only re-runs if cachedData or debouncedPeriod changes)
  const computedStats = useMemo(() => {
    if (!cachedData[debouncedPeriod]) return null;

    const { rawShiftData, usersData } = cachedData[debouncedPeriod];
    const validUsers = (usersData.value || []).filter(
      (u) =>
        u.jobTitle &&
        u.jobTitle.trim() !== "" &&
        !u.jobTitle.toLowerCase().includes("chief")
    );

    const grouped = { present: [], tardy: [], absent: [], restDay: [], leave: [] };
    const groupedForCharts = { present: [], tardy: [], absent: [] };
    let nonAdherentCount = 0;

    validUsers.forEach((u) => {
      const emailKey = (u.mail || u.userPrincipalName || "").toLowerCase();
      const userShiftsObj = rawShiftData.shiftDetailsPerUser?.[emailKey] || {};

      const userShifts = Object.values(userShiftsObj).map((shift) => {
        const shiftDate = shift.date || shift.start;
        const shiftBreak = shift.breakMinutes ?? 0;
        let status = shift.type || "Absent";
        

        if (shift.clockIn) {
          const loginTime = new Date(shift.clockIn);
          const shiftStart = new Date(shift.start);
          const cutoff = new Date(shiftStart);
          cutoff.setHours(8, 31, 0, 0);

          status = loginTime <= cutoff ? "Present" : "Tardy";
        }

        return {
          date: shiftDate,
          status,
          clockIn: shift.clockIn || null,
          clockOut: shift.clockOut || null,
          breakMinutes: shiftBreak,
        };
      });

      let presentCount = userShifts.filter((s) => s.status === "Present").length;
      let tardyCount = userShifts.filter((s) => s.status === "Tardy").length;
      let absentCount = userShifts.filter((s) => s.status === "Absent").length;
      const firstLogin = userShifts
        .filter((s) => s.clockIn)
        .sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn))[0]?.clockIn || null;

      const detail = {
        userId: u.id,
        name: u.displayName || u.mail || u.userPrincipalName || "Unknown",
        email: emailKey,
        totalPresent: presentCount,
        totalTardy: tardyCount,
        totalAbsent: absentCount,
        totalShifts: userShifts.length,
        shifts: userShifts,
        firstLogin,
      };

      if (userShifts.some((s) => s.status === "Present")) grouped.present.push(detail);
      else if (userShifts.some((s) => s.status === "Tardy")) grouped.tardy.push(detail);
      else grouped.absent.push(detail);

      if (userShifts.some((s) => s.status === "Present")) groupedForCharts.present.push(detail);
      else if (userShifts.some((s) => s.status === "Tardy")) groupedForCharts.tardy.push(detail);
      else groupedForCharts.absent.push(detail);

      const hasExcessBreak = userShifts.some((s) => s.breakMinutes > 75);
      if (hasExcessBreak) nonAdherentCount++;
    });

    const totalCountForCharts =
      groupedForCharts.present.length +
      groupedForCharts.tardy.length +
      groupedForCharts.absent.length;

    const tardyCount = [...groupedForCharts.present, ...groupedForCharts.tardy].filter(
      (u) => u.shifts.some((s) => s.status === "Tardy")
    ).length;

    const chartStats = [
      {
        name: "Present",
        value: totalCountForCharts > 0 ? Math.round((groupedForCharts.present.length / totalCountForCharts) * 100) : 0,
      },
      {
        name: "Tardy",
        value: totalCountForCharts > 0 ? Math.round(((totalCountForCharts - tardyCount) / totalCountForCharts) * 100) : 0,
      },
      {
        name: "Absent",
        value: totalCountForCharts > 0 ? Math.round((groupedForCharts.absent.length / totalCountForCharts) * 100) : 0,
      },
    ];

    const totalUsers = validUsers.length;
    const adherencePercent = totalUsers > 0 ? Math.round(((totalUsers - nonAdherentCount) / totalUsers) * 100) : 100;

    return {
      details: grouped,
      chartStats,
      attendance: chartStats.find((x) => x.name === "Present")?.value || 0,
      tardiness: chartStats.find((x) => x.name === "Tardy")?.value || 0,
      adherence: adherencePercent,
    };
  }, [cachedData, debouncedPeriod]);

  // Fetch and cache data only if not already cached
  useEffect(() => {
    async function fetchStats() {
      if (cachedData[debouncedPeriod]) {
        setDailyStats(computedStats);
        return;
      }

      setLoadingStats(true);
      try {
        const [shiftsRes, usersRes] = await Promise.all([
          fetch(`/api/shifts?period=${debouncedPeriod}`),
          fetch("/api/users"),
        ]);

        const rawShiftData = shiftsRes.ok ? await shiftsRes.json() : { shiftDetailsPerUser: {} };
        const usersData = usersRes.ok ? await usersRes.json() : { value: [] };

        setCachedData((prev) => ({ ...prev, [debouncedPeriod]: { rawShiftData, usersData } }));
      } catch (err) {
        console.error("Error fetching stats:", err);
      } finally {
        setLoadingStats(false);
      }
    }

    fetchStats();
  }, [debouncedPeriod, refreshKey]);

  // Set stats when computed
  useEffect(() => {
    if (computedStats) setDailyStats(computedStats);
  }, [computedStats]);

  // fetch disciplinary actions (unchanged)
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

 // build pieData (memoized for better performance and reactivity)
const buildPieData = useMemo(() => {
  if (!selectedUser) {
    // Overall stats (unchanged)
    return [
      { name: "Attendance", value: Math.round(dailyStats.attendance || 100) },
      { name: "Tardiness", value: Math.round(dailyStats.tardiness || 100) },
      { name: "Adherence", value: Math.round(dailyStats.adherence || 100) },
      { name: "Disciplinary Action", value: disciplinaryPercent },
    ];
  } else {
    // Per-user stats
    const userDetail = [
      ...dailyStats.details.present,
      ...dailyStats.details.tardy,
      ...dailyStats.details.absent,
    ].find((u) => u.userId === selectedUser.id);

    if (!userDetail) {
      // Fallback if user not found
      return [
        { name: "Attendance", value: 0 },
        { name: "Tardiness", value: 0 },
        { name: "Adherence", value: 100 },
        { name: "Disciplinary Action", value: 100 },
      ];
    }

    const { totalPresent, totalTardy, totalShifts, shifts } = userDetail;

    // Attendance: 100% if they have at least one present shift, else 0%
    const attendanceVal = totalPresent > 0 ? 100 : 0;

    // Tardiness: % of shifts that are tardy
    const tardinessVal = totalShifts > 0 ? Math.round((totalTardy / totalShifts) * 100) : 0;

    // Adherence: 100% if no shifts exceed 75 min break, else 0%
    const hasExcessBreak = shifts.some((s) => s.breakMinutes > 75);
    const adherenceVal = hasExcessBreak ? 0 : 100;

    // DA: 100% if no actions, else 0%
    const hasDA = disciplinaryRecords[selectedUser.id]?.length > 0;
    const daVal = hasDA ? 0 : 100;

    return [
      { name: "Attendance", value: attendanceVal },
      { name: "Tardiness", value: tardinessVal },
      { name: "Adherence", value: adherenceVal },
      { name: "Disciplinary Action", value: daVal },
    ];
  }
}, [selectedUser, dailyStats, disciplinaryPercent, disciplinaryRecords]);

const pieData = buildPieData;


  const handleAddDA = useCallback(async () => {
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
  }, [selectedUser, newDA]);

  // group users by department
  const groupedByDept = useMemo(() => {
    const grouped = {};
    users.forEach((u) => {
      const dept = TEAM_MAP[u.email?.toLowerCase()] || "Other";
      if (!grouped[dept]) grouped[dept] = [];
      grouped[dept].push(u);
    });
    return grouped;
  }, [users]);

  // Refresh DA from backend
  const refreshDA = useCallback(async () => {
    try {
      const res = await fetch("/api/disciplinary");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setDisciplinaryRecords(data || {});
    } catch (err) {
      console.error("refreshDA error", err);
    }
  }, []);

  const handleDeleteDA = useCallback(async (id) => {
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

      await refreshDA();
    } catch (err) {
      console.error("handleDeleteDA error", err);
      alert("Failed to delete disciplinary action — please try again.");
    }
  }, [refreshDA]);

  const presentList = [...dailyStats.details.present, ...dailyStats.details.tardy];

  const absentList = dailyStats.details.absent || [];

  const leaveRestList = [
    ...dailyStats.details.restDay,
    ...dailyStats.details.leave,
  ];

  if (status === "loading") return <p>Loading...</p>;

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

          {/* Period Filter */}
          <div className="flex gap-2 mb-4">
            {["daily", "weekly", "monthly"].map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 rounded ${
                  period === p ? "bg-blue-900 text-white" : "bg-gray-200 text-gray-700"
                }`}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
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
        {selectedUser ? `${selectedUser.name}'s Attendance` : "Attendance Breakdown"}
      </Dialog.Title>

      <div className="mt-4 space-y-6 max-h-80 overflow-y-auto">
        {(() => {
          const today = new Date().toISOString().split('T')[0];
          const isDaily = period === "daily";

          // Filter users: if selectedUser, only that user; else all
          const usersToShow = selectedUser
            ? [presentList.find((u) => u.userId === selectedUser.id)].filter(Boolean)
            : presentList;

          return (
            <>
              {/* PRESENT (includes TARDY) */}
              {usersToShow.length > 0 && (
                <div>
                  <h4 className="font-medium text-green-600 mb-2">
                    Present ({usersToShow.length})
                  </h4>
                  <ul className="space-y-2">
                    {usersToShow.map((u) => {
                      const filteredShifts = isDaily
                        ? u.shifts.filter((s) => new Date(s.date).toISOString().split('T')[0] === today)
                        : u.shifts;

                      return (
                        <li
                          key={u.userId}
                          className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm"
                        >
                          <p className="font-medium text-gray-800">{u.name}</p>
                          <ul className="ml-4 mt-1 text-gray-700 list-disc">
                            {filteredShifts.map((s, idx) => (
                              <li key={idx}>
                                {new Date(s.date).toLocaleDateString()} — {s.type}
                                {s.clockIn && (
                                  <> (In: {new Date(s.clockIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})</>
                                )}
                                {s.clockOut && (
                                  <> (Out: {new Date(s.clockOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})</>
                                )}
                                {s.breakMinutes > 0 && <> — Break: {s.breakMinutes}m</>}
                              </li>
                            ))}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* ABSENT */}
              {(() => {
                const absentUsersToShow = selectedUser
                  ? [absentList.find((u) => u.userId === selectedUser.id)].filter(Boolean)
                  : absentList;

                return absentUsersToShow.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-600 mb-2">
                      Absent ({absentUsersToShow.length})
                    </h4>
                    <ul className="space-y-2">
                      {absentUsersToShow.map((u) => {
                        const filteredShifts = isDaily
                          ? u.shifts.filter((s) => new Date(s.date).toISOString().split('T')[0] === today)
                          : u.shifts;

                        return (
                          <li
                            key={u.userId}
                            className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm"
                          >
                            <p className="font-medium text-gray-800">{u.name}</p>
                            <ul className="ml-4 mt-1 list-disc text-gray-700">
                              {filteredShifts.map((s, idx) => (
                                <li key={idx}>
                                  {new Date(s.date).toLocaleDateString()} — Absent
                                </li>
                              ))}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })()}

              {/* LEAVE + REST DAY */}
              {(() => {
                const leaveUsersToShow = selectedUser
                  ? [leaveRestList.find((u) => u.userId === selectedUser.id)].filter(Boolean)
                  : leaveRestList;

                return leaveUsersToShow.length > 0 && (
                  <div>
                    <h4 className="font-medium text-blue-600 mb-2">
                      Leave / Rest Day ({leaveUsersToShow.length})
                    </h4>
                    <ul className="space-y-2">
                      {leaveUsersToShow.map((u) => {
                        const filteredShifts = isDaily
                          ? u.shifts.filter((s) => new Date(s.date).toISOString().split('T')[0] === today)
                          : u.shifts;

                        return (
                          <li
                            key={u.userId}
                            className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm"
                          >
                            <p className="font-medium text-gray-800">{u.name}</p>
                            <ul className="ml-4 mt-1 list-disc text-gray-700">
                              {filteredShifts.map((s, idx) => (
                                <li key={idx}>
                                  {new Date(s.date).toLocaleDateString()} — {s.type}
                                </li>
                              ))}
                            </ul>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })()}
            </>
          );
        })()}
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
        {selectedUser ? `${selectedUser.name}'s Tardiness` : "Tardiness"}
      </Dialog.Title>

      {(() => {
        const tardyUsers = [...dailyStats.details.present, ...dailyStats.details.tardy].filter(
          (u) => u.shifts.some((s) => s.status === "Tardy")
        );

        // Filter to selected user if set
        const usersToShow = selectedUser
          ? tardyUsers.filter((u) => u.userId === selectedUser.id)
          : tardyUsers;

        return usersToShow.length > 0 ? (
          <ul className="mt-4 space-y-2 max-h-80 overflow-y-auto">
            {usersToShow.map((u) => (
              <li
                key={u.userId}
                className="flex flex-col text-sm p-3 rounded bg-yellow-50 border border-yellow-200"
              >
                <span className="font-medium">{u.name}</span>
                <ul className="ml-4 list-disc text-yellow-700">
                  {u.shifts
                    .filter((s) => s.status === "Tardy")
                    .map((s, idx) => (
                      <li key={idx}>
                        {s.date
                          ? new Date(s.date).toLocaleDateString()
                          : "N/A"}{" "}
                        - {s.status}{" "}
                        {s.clockIn &&
                          `(Login: ${new Date(s.clockIn).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })})`}
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No tardy employees</p>
        );
      })()}

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
        {selectedUser ? `${selectedUser.name}'s Adherence` : "Adherence"}
      </Dialog.Title>

      {(() => {
        const adherenceUsers = [...dailyStats.details.present, ...dailyStats.details.tardy].filter(
          (u) => u.shifts.some((s) => s.breakMinutes > 75)
        );

        // Filter to selected user if set
        const usersToShow = selectedUser
          ? adherenceUsers.filter((u) => u.userId === selectedUser.id)
          : adherenceUsers;

        return usersToShow.length > 0 ? (
          <ul className="mt-4 space-y-2 max-h-80 overflow-y-auto">
            {usersToShow.map((u) => (
              <li
                key={u.userId}
                className="flex flex-col text-sm p-3 rounded bg-red-50 border border-red-200"
              >
                <span className="font-medium">{u.name}</span>
                <ul className="ml-4 list-disc text-red-700">
                  {u.shifts
                    .filter((s) => s.breakMinutes > 75)
                    .map((s, idx) => (
                      <li key={idx}>
                        {s.date
                          ? new Date(s.date).toLocaleDateString()
                          : "N/A"}{" "}
                        - Break: {s.breakMinutes} min
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-gray-500">
            No employees exceeded the break limit
          </p>
        );
      })()}

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

export default function OverviewPage() {
  return (
    <SessionProvider>
      <OverviewContent />
    </SessionProvider>
  );
}