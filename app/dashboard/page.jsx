"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import jwtDecode from "jwt-decode";

export default function UserList() {
  const [chiefs, setChiefs] = useState([]);
  const [groupedUsers, setGroupedUsers] = useState({});

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        if (data.value) {
          const chiefsList = [];
          const groups = {};

          data.value.forEach((user) => {
            // ✅ Skip users without job title or without assigned licenses
            if (!user.jobTitle || !user.assignedLicenses || user.assignedLicenses.length === 0) return;

            const jobTitle = user.jobTitle;
            const isChief = jobTitle.toLowerCase().includes("chief");

            if (isChief) {
              chiefsList.push(user);
            } else {
              if (!groups[jobTitle]) groups[jobTitle] = [];
              groups[jobTitle].push(user);
            }
          });

          setChiefs(chiefsList);
          setGroupedUsers(groups);
        } else {
          console.error("Error fetching users:", data);
        }
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Our Team</h2>

        {/* ✅ Chiefs at top in a single horizontal line */}
        {chiefs.length > 0 && (
          <div className="mb-12">
            <h3 className="text-xl font-semibold text-blue-900 mb-4">Stakeholders</h3>
            <div className="flex flex-wrap gap-4">
              {chiefs.map((user) => (
                <div
                  key={user.id}
                  className="bg-white rounded-2xl shadow p-4 w-64 hover:shadow-md transition"
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

        {/* ✅ Grouped users excluding Chiefs */}
        {Object.keys(groupedUsers).length === 0 ? (
          <p className="text-gray-600">Loading...</p>
        ) : (
          Object.entries(groupedUsers)
            .sort(([a], [b]) => a.localeCompare(b)) // A-Z job titles
            .map(([groupKey, users]) => (
              <div key={groupKey} className="mb-10">
                <h3 className="text-xl font-semibold text-blue-900 mb-3">{groupKey}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="bg-white rounded-2xl shadow p-4 hover:shadow-md transition"
                    >
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">
                        {user.displayName}
                      </h4>
                      <p className="text-gray-600 text-sm">
                        {user.mail || user.userPrincipalName}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
