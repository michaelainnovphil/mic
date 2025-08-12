"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

const Header = () => {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState("");

  const handleLogout = () => {
    localStorage.removeItem("token");
    setName("");
    setPhoto("");
    router.replace("/");
  };

  useEffect(() => {
    const fetchUser = async () => {
      const response = await fetch("/api/users", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "auth-token": localStorage.getItem("token") || "",
        },
      });
      let rjson = await response.json();

      console.log("API /api/users response:", rjson); // Debugging

      if (rjson.value && rjson.email) {
        const currentUser = rjson.value.find(
  u =>
    u.mail?.toLowerCase() === rjson.email.toLowerCase() ||
    u.userPrincipalName?.toLowerCase() === rjson.email.toLowerCase()
);


        if (currentUser) {
          setName(currentUser.displayName || "");
          setPhoto(currentUser.photo || "");
          setToken(localStorage.getItem("token") || "");
        }
      }
    };
    fetchUser();
  }, []);

  return (
    <header className="bg-white shadow-md rounded-md">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Logo" className="w-17 h-14 rounded" />
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-6">
          <Link
            href="/tasks"
            className="text-gray-700 hover:text-blue-600 font-medium transition"
          >
            Task
          </Link>
          <Link
            href="/dashboard"
            className="text-gray-700 hover:text-blue-600 font-medium transition"
          >
            Dashboard
          </Link>

          {/* Profile Photo + Dropdown */}
          {photo && (
            <div className="relative group">
              <img
                src={photo}
                alt={name}
                className="w-10 h-10 rounded-full border border-gray-300 cursor-pointer"
              />
              <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow-md opacity-0 group-hover:opacity-100 transition">
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 hover:bg-gray-100"
                >
                  Logout
                </button>
              </div>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;
