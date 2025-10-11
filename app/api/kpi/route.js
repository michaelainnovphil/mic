import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/authOptions";
import connectToDatabase from "@/lib/mongodb";
import mongoose from "mongoose";

const GRAPH_API_USERS = "https://graph.microsoft.com/v1.0/users?$select=displayName,mail,userPrincipalName,jobTitle,id,assignedLicenses";
const GRAPH_API_MEMBEROF = (userId) => `https://graph.microsoft.com/v1.0/users/${userId}/memberOf`;

async function fetchEntraUsers(token) {
  const usersRes = await fetch(GRAPH_API_USERS, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const usersData = await usersRes.json();
  if (!usersRes.ok) return [];
  const users = usersData.value || [];
  return users.filter((u) => u.jobTitle && u.jobTitle.trim() !== "" && !u.jobTitle.toLowerCase().includes("chief") && u.assignedLicenses?.length);
}

// Mongoose models
const TaskLog = mongoose.models.TaskLog || mongoose.model("TaskLog", new mongoose.Schema({}, { strict: false }), "tasklogs");
const Disciplinary = mongoose.models.Disciplinary || mongoose.model("Disciplinary", new mongoose.Schema({}, { strict: false }), "disciplinary");

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session || !session.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");
    if (!month || !year) {
      return Response.json({ error: "Missing month or year" }, { status: 400 });
    }

    await connectToDatabase();
    const users = await fetchEntraUsers(session.accessToken);

    // Get all disciplinary actions for the month
    const startDate = new Date(`${year}-${month}-01T00:00:00.000Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    const allDA = await Disciplinary.find({
      timestamp: { $gte: startDate, $lt: endDate }
    }).lean();

    // Build DA map
    const daMap = {};
    allDA.forEach((da) => {
      if (!daMap[da.userId]) daMap[da.userId] = [];
      daMap[da.userId].push(da);
    });

    const kpiResults = [];

    for (const user of users) {
      const email = (user.mail || user.userPrincipalName || "").toLowerCase();
      const userId = user.id;

      // Get all logs for this user in the month
      const logs = await TaskLog.find({
        email,
        timestamp: { $gte: startDate, $lt: endDate }
      }).lean();

      // Attendance: present if any log for the month
      const attendance = logs.length > 0 ? 100 : 50;

      // Tardiness: count days with first login after 8:30am
      let tardyDays = 0;
      let presentDays = 0;
      const loginsByDay = {};
      logs.forEach(log => {
        const d = new Date(log.timestamp);
        const dayKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        if (!loginsByDay[dayKey] || d < loginsByDay[dayKey]) {
          loginsByDay[dayKey] = d;
        }
      });
      Object.values(loginsByDay).forEach(firstLogin => {
        presentDays++;
        const cutoff = new Date(firstLogin);
        cutoff.setHours(8, 30, 0, 0);
        if (firstLogin > cutoff) tardyDays++;
      });
      let tardiness = 100;
      if (presentDays > 0) {
        tardiness = Math.round(((presentDays - tardyDays) / presentDays) * 100);
      }

      // Adherence: if any breakExceeded, score is 50%, else 100%
      let adherence = 100;
      if (logs.some(log => log.breakExceeded)) adherence = 50;

      // Disciplinary: if any DA for user, 0%, else 100%
      const hasDA = daMap[userId]?.length > 0;
      const disciplinary = hasDA ? 0 : 100;

      kpiResults.push({
        userId,
        name: user.displayName,
        email,
        attendance,
        tardiness,
        adherence,
        disciplinary
      });
    }

    // Overall averages
    const overall = {};
    if (kpiResults.length > 0) {
      for (const key of ["attendance", "tardiness", "adherence", "disciplinary"]) {
        overall[key] = Math.round(
          kpiResults.reduce((sum, u) => sum + (u[key] || 0), 0) / kpiResults.length
        );
      }
    }

    return Response.json({
      overall,
      users: kpiResults
    });
  } catch (err) {
    console.error("Error in /api/kpi:", err);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}