"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

const Header = () => {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState("");
  const [isAllowed, setIsAllowed] = useState(false);
  const [isAllowedHR, setIsAllowedHR] = useState(false);

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

      if (rjson.value && rjson.email) {
        const currentUser = rjson.value.find(
          (u) =>
            u.mail?.toLowerCase() === rjson.email.toLowerCase() ||
            u.userPrincipalName?.toLowerCase() === rjson.email.toLowerCase()
        );

        if (currentUser) {
          setName(currentUser.displayName || "");
          setPhoto(currentUser.photo || "");
          setToken(localStorage.getItem("token") || "");

          const allowedEmails = [
            "mdbarreda@innovphil.com",
            "aarce@innovphil.com",
            "carce@innovphil.com",
            "amlinguete@innovphil.com",
            "mcastilla@innovphil.com",
            "mjpanotes@innovphil.com",
            "mgpajarillo@innovphil.com",
            "jksanjose@innovphil.com",
            "jabayon@innovphil.com",
          ];
          if (
            allowedEmails.includes(
              currentUser.mail?.toLowerCase() ||
                currentUser.userPrincipalName?.toLowerCase()
            )
          ) {
            setIsAllowed(true);
          }

          const allowedHREmails = [
            "mdbarreda@innovphil.com",
            "aarce@innovphil.com",
            "carce@innovphil.com",
          ];
          if (
            allowedHREmails.includes(
              currentUser.mail?.toLowerCase() ||
                currentUser.userPrincipalName?.toLowerCase()
            )
          ) {
            setIsAllowedHR(true);
          }
        }
      }
    };
    fetchUser();
  }, []);

  return (
    <header className="bg-white dark:bg-gray-900 shadow-md rounded-md border-b border-gray-200 dark:border-gray-700">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-4">
          <img
            src="/logo.png"
            alt="Logo"
            className="w-14 h-14 rounded object-contain"
          />
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-6">
          {isAllowedHR && (
            <Link
              href="/hr"
              className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition"
            >
              HR
            </Link>
          )}
          <Link
            href="/tasks"
            className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition"
          >
            Task
          </Link>
          <Link
            href="/dashboard"
            className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition"
          >
            Dashboard
          </Link>
          <Link
            href="/overview"
            className="text-gray-700 dark:text-gray-200 hover:text-blue-600 dark:hover:text-blue-400 font-medium transition"
          >
            Team Overview
          </Link>

          {isAllowed && (
            <Link
              href="/assignment"
              className="text-blue-900 dark:text-blue-300 font-regular px-3 py-1 border border-blue-900 dark:border-blue-300 rounded hover:bg-blue-900 dark:hover:bg-blue-300 hover:text-white dark:hover:text-gray-900 transition"
            >
              Assign Task
            </Link>
          )}

          {/* Profile Photo + Dropdown */}
          {photo && (
            <div className="relative group">
              <img
                src={photo}
                alt={name}
                className="w-10 h-10 rounded-full border border-gray-300 dark:border-gray-700 cursor-pointer"
              />
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border rounded shadow-md opacity-0 group-hover:opacity-100 transition">
                {/* Dropdown content here */}
              </div>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Header;