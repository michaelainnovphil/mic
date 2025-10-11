"use client";

import { useEffect, useState } from "react";

export default function UserKPI({ email, month, year }) {
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKPI() {
      setLoading(true);
      try {
        const res = await fetch(`/api/kpi?email=${email}&month=${month}&year=${year}`);
        const data = await res.json();
        setKpi(data); 
      } catch (err) {
        setKpi(null);
      } finally {
        setLoading(false);
      }
    }
    if (email && month && year) fetchKPI();
  }, [email, month, year]);

  if (loading) return <div>Loading KPI...</div>;
  if (!kpi) return <div>No KPI data available.</div>;

  return (
    <div>
      <h2>KPI Scores</h2>
      <ul>
        <li>Attendance: {kpi.attendance}%</li>
        <li>Tardiness: {kpi.tardiness}%</li>
        <li>Disciplinary: {kpi.disciplinary}%</li>
        <li>Adherence: {kpi.adherence}%</li>
        <li>On Time Completion: {kpi.onTimeCompletion}%</li>
        <li>Average Handle Time: {kpi.avgHandleScore}%</li>
        <li>Task Abandon Rate: {kpi.abandonScore}%</li>
        <li>Utilization Rate: {kpi.utilizationScore}%</li>
      </ul>
    </div>
  );
}