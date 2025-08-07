import clientPromise from "@/lib/mongodb";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  try {
    const client = await clientPromise;
    const db = client.db();
    const { logIds } = req.body; // array of MongoDB ObjectId strings

    const result = await db.collection("taskLogs").updateMany(
      { _id: { $in: logIds.map(id => new ObjectId(id)) } },
      { $set: { exported: true, exportedAt: new Date() } }
    );

    res.status(200).json({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error("Error marking logs as exported:", error);
    res.status(500).json({ success: false });
  }
}
