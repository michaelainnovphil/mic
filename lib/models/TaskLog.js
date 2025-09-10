// lib/models/TaskLog.js

import mongoose from "mongoose";

const TaskLogSchema = new mongoose.Schema({
  email: { type: String, required: true },
  taskId: { type: String, required: true },
  task: { type: String },
  taskType: { type: String },
  description: { type: String },
  durationSeconds: { type: Number, default: 0 }, 
  timestamp: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  timestamps: [{ type: Date }], 
});

export default mongoose.models.TaskLog || mongoose.model("TaskLog", TaskLogSchema);
