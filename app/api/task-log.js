// /pages/api/task-log.js
import { connectToDatabase } from "@/lib/mongodb";

export default async function handler(req, res) {
  const { db } = await connectToDatabase();
  const collection = db.collection("taskLogs");

  if (req.method === "POST") {
    const log = req.body;
    await collection.insertOne(log);
    return res.status(201).json({ message: "Log saved" });
  }

  if (req.method === "GET") {
    const logs = await collection.find({}).toArray();
    return res.status(200).json({ logs });
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).end(`Method ${req.method} Not Allowed`);
}
