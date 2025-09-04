// /pages/api/task-log.js
import { getServerSession } from "next-auth";
import { authOptions } from "./auth/[...nextauth]"; // adjust path if different
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import Task from "@/lib/models/Task";

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions);
    const email = session?.user?.email;

    if (!email) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    await connectToDatabase();
    const { db } = await connectToDatabase();
    const collection = db.collection("tasklogs");

    if (req.method === "POST") {
      console.log("Incoming body:", req.body);

      const { taskId, action } = req.body;
      const now = new Date();

      if (!taskId || !action) {
        console.error("❌ Missing required fields:", { taskId, action });
        return res.status(400).json({ error: "Missing required fields" });
      }

      // --- handle start/resume
      if (action === "start" || action === "resume") {
        const log = { email, taskId, action, timestamp: now };
        await collection.insertOne(log);
        return res.status(201).json({ success: true, message: "Task started/resumed", log });
      }

      // --- handle stop
      if (action === "stop") {
        const latestStart = await collection.findOne(
          { taskId, email, action: { $in: ["start", "resume"] } },
          { sort: { timestamp: -1 } }
        );

        if (!latestStart) {
          return res.status(400).json({ error: "No matching start/resume found for stop" });
        }

        const durationSeconds = Math.floor((now - latestStart.timestamp) / 1000);

        const stopLog = {
          email,
          taskId,
          action: "stop",
          timestamp: now,
          durationSeconds,
        };
        await collection.insertOne(stopLog);

        await Task.updateOne(
          { _id: new ObjectId(taskId) },
          { $inc: { duration: durationSeconds } }
        );

        return res.status(201).json({
          success: true,
          message: "Task stopped & duration updated",
          stopLog,
        });
      }

      return res.status(400).json({ error: "Invalid action" });
    }

    if (req.method === "GET") {
      const logs = await collection.find({}).sort({ timestamp: -1 }).toArray();
      return res.status(200).json({ success: true, logs });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (err) {
    console.error("Error in /api/task-log:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}
