// /pages/api/task-log.js
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export default async function handler(req, res) {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("tasklogs");
    const tasks = db.collection("tasks");

    if (req.method === "POST") {
      const log = req.body;

      // basic validation
      if (!log || !log.user || !log.taskId || log.duration === undefined) {
        return res.status(400).json({ error: "Missing required fields" });
      }


      // always ensure timestamp
      log.timestamp = log.timestamp ? new Date(log.timestamp) : new Date();

      await collection.insertOne(log);

      // increment duration on Task
      await tasks.updateOne(
        { _id: new ObjectId(log.taskId) },
        { $inc: { duration: log.duration } }
      );

      return res.status(201).json({ success: true, message: "Log saved & duration updated" });
    }

    if (req.method === "GET") {
      const logs = await collection.find({}).sort({ timestamp: -1 }).toArray();
      return res.status(200).json({ success: true, logs });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  } catch (err) {
    console.error("Error in /api/task-log:", err);
    return res
      .status(500)
      .json({ success: false, error: "Internal Server Error" });
  }
}
