// lib/getUserShifts.js

"use client";

export async function getUserShifts(accessToken, teamId, userId) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/teams/${teamId}/schedule/shifts?$filter=userid eq '${userId}'`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  if (!response.ok) {
    throw new Error("Failed to fetch shifts");
  }

  const data = await response.json();
  return data.value;
}

console.log("Fetched shifts:", shifts);
console.log("User ID:", userId);
