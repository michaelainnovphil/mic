import mongoose from "mongoose";

const TaskLogSchema = new mongoose.Schema({
  email: { type: String, required: true },
  taskId: { type: String, required: true },
  task: { type: String },
  taskType: { type: String },
  description: { type: String },
  durationSeconds: { type: Number, required: true }, 
  timestamp: { type: Date, default: Date.now },
});

export default mongoose.models.TaskLog || mongoose.model("TaskLog", TaskLogSchema);
