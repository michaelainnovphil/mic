// scripts/syncShifts.js
import { getDb } from "../lib/db";

export async function syncShifts(shiftsFromGraph) {
  const db = await getDb();
  for (const s of shiftsFromGraph) {
    await db.collection("shifts").updateOne(
      { userId: s.userId, startTime: s.startTime },
      { $set: s },
      { upsert: true }
    );
  }
  console.log("Shifts synced to DB");
}
