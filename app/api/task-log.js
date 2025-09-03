// /pages/api/task-log.js
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("tasklogs");
    const tasks = db.collection("tasks");

    if (req.method === "POST") {
      const { user, taskId, action } = req.body;
      const now = new Date();

      if (!user || !taskId || !action) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // --- handle task start/resume ---
      if (action === "start" || action === "resume") {
        const log = {
          user,
          taskId,
          action,
          timestamp: now,
        };
        await collection.insertOne(log);

        return res.status(201).json({ success: true, message: "Task started/resumed", log });
      }

      // --- handle task stop ---
      if (action === "stop") {
        // find the latest start/resume before this stop
        const latestStart = await collection.findOne(
          { taskId, user, action: { $in: ["start", "resume"] } },
          { sort: { timestamp: -1 } }
        );

        if (!latestStart) {
          return res.status(400).json({ error: "No matching start/resume found for stop" });
        }

        const durationSeconds = Math.floor((now - latestStart.timestamp) / 1000);

        // insert stop log with duration
        const stopLog = {
          user,
          taskId,
          action: "stop",
          timestamp: now,
          durationSeconds,
        };
        await collection.insertOne(stopLog);

        // increment duration on task (store in seconds)
        await tasks.updateOne(
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
