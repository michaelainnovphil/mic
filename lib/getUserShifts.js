// lib/getUserShifts.js
// Server helper to fetch shifts for a single user
// Usage: const shifts = await getUserShifts(accessToken, teamId, userId);

export async function getUserShifts(accessToken, teamId, userId) {
  if (!accessToken || !teamId || !userId) return [];

  const url = `https://graph.microsoft.com/v1.0/teams/${teamId}/schedule/shifts?$filter=userid eq '${userId}'`;

  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    // bubble up a useful error for server logs
    const txt = await resp.text().catch(() => "");
    throw new Error(`getUserShifts: Graph fetch failed ${resp.status} ${txt}`);
  }

  const data = await resp.json();
  return Array.isArray(data.value) ? data.value : [];
}
