// lib/attendancedb.js
import { MongoClient } from "mongodb";

let client;
let db;

export async function getDb() {
  if (!db) {
    client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    db = client.db("attendanceDB"); // your DB name
  }
  return db;
}
