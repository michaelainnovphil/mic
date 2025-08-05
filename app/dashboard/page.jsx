"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import jwtDecode from "jwt-decode";



export default function UserList() {
  const [groupedUsers, setGroupedUsers] = useState({});

  useEffect(() => {
  fetch("/api/users")
    .then((res) => res.json())
    .then((data) => {
      if (data.value) {
        const groups = {};

        data.value.forEach((user) => {
          // ✅ Only include users with assigned licenses
          if (!user.assignedLicenses || user.assignedLicenses.length === 0) return;

          const jobTitle = user.jobTitle || "No Job Title";
          const groupKey = `${jobTitle}`;

          if (!groups[groupKey]) groups[groupKey] = [];
          groups[groupKey].push(user);
        });

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

        {Object.keys(groupedUsers).length === 0 ? (
          <p className="text-gray-600">Loading...</p>
        ) : (
          Object.entries(groupedUsers).map(([groupKey, users]) => (
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
