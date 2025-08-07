import clientPromise from "@/lib/mongodb";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end("Method Not Allowed");
  }

  try {
    const client = await clientPromise;
    const db = client.db();
    const { task, startTime, endTime, duration, user } = req.body;

    const result = await db.collection("taskLogs").insertOne({
      task,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      duration,
      user,
      exported: false,
      createdAt: new Date(),
    });1

    res.status(200).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    console.error("Error saving task log:", error);
    res.status(500).json({ success: false, error: "Internal Server Error" });
  }
}
