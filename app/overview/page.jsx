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

export default function OverviewPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pie chart sample data (static for now)
  const pieData = [
    { name: "Attendance", value: 90 },
    { name: "Tardiness", value: 85 },
    { name: "Adherence", value: 92 },
    { name: "Disciplinary Action", value: 88 },
    { name: "On-Time Completion", value: 91 },
  ];

  useEffect(() => {
    async function fetchUsers() {
      try {
        // fetch users from Graph
        const res = await fetch("/api/users");
        const data = await res.json();

        // fetch ALL tasks once
        const tasksRes = await fetch("/api/tasks");
        const allTasks = tasksRes.ok ? await tasksRes.json() : [];

        if (res.ok && data.value) {
          const validUsers = data.value.filter(
            (u) =>
              u.jobTitle &&
              u.jobTitle.trim() !== "" &&
              !u.jobTitle.toLowerCase().includes("chief")
          );

          // Build stats indexed by identifier (email/displayName), case-insensitive
          const statsByKey = {}; // key -> { total, completed }
          const bump = (key, isCompleted) => {
            const k = (key || "unassigned").toString().trim().toLowerCase();
            if (!statsByKey[k]) statsByKey[k] = { total: 0, completed: 0 };
            statsByKey[k].total += 1;
            if (isCompleted) statsByKey[k].completed += 1;
          };

          (allTasks || []).forEach((task) => {
            const isCompleted = task.status === "completed";

            // assignedTo can be array or string or missing
            let assigned = [];
            if (Array.isArray(task.assignedTo)) {
              assigned = task.assignedTo;
            } else if (typeof task.assignedTo === "string" && task.assignedTo.trim() !== "") {
              assigned = [task.assignedTo];
            } else {
              assigned = ["unassigned"];
            }

            assigned.forEach((who) => bump(who, isCompleted));
          });

          const usersWithTasks = validUsers.map((u) => {
            const emailKey = (u.mail || u.userPrincipalName || "").toLowerCase();
            const nameKey = (u.displayName || "").toLowerCase();

            const stat =
              statsByKey[emailKey] ||
              statsByKey[nameKey] ||
              { total: 0, completed: 0 };

            const completed = stat.completed || 0;
            const total = stat.total || 0;
            const percentage = total > 0 ? (completed / total) * 100 : 0;

            return {
              id: u.id,
              name: u.displayName || u.mail || u.userPrincipalName || "Unknown",
              email: u.mail || u.userPrincipalName || null,
              completed,
              total,
              percentage, // <- used for ranking and chart
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

    fetchUsers();
  }, []);

  // Sort employees by completion percentage
  const sortedEmployees = [...users].sort((a, b) => b.percentage - a.percentage);
  const top3 = sortedEmployees.slice(0, 3);
  const others = sortedEmployees.slice(3);

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
              <div key={item.name} className="flex flex-col items-center">
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

        {/* Monthly Average */}
        <div className="bg-white shadow rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-6">
            Monthly Average For Naga/Makati
          </h2>

          {loading ? (
            <p>Loading users...</p>
          ) : (
            <div className="grid md:grid-cols-2 gap-10">
              {/* Top Performers */}
              <div>
                <h3 className="text-md font-semibold mb-4 text-center">
                  Top Performers
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
                      <span className="mt-2 font-medium">
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
                      className="flex flex-col items-center text-gray-500"
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
                <h3 className="text-md font-semibold mb-4 text-center">
                  Tasks per Employee
                </h3>
                <div className="w-full h-200 overflow-y-auto">
                  {/* allow scroll if too many users */}
                  <ResponsiveContainer width="100%" height={users.length * 40}>
                    <BarChart
                      data={users}
                      layout="vertical" // horizontal bars
                      margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                      <XAxis type="number" domain={[0, 100]} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={120}
                        tick={{ fontSize: 12 }}
                        interval={0}   // force all labels to show
                      />
                      <Tooltip />
                      {/* Use percentage-based bars */}
                      <Bar dataKey="percentage" fill="#1E3A8A" radius={[0, 6, 6, 0]} />
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
