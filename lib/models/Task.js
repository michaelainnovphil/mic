// lib/models/Task.js
import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema({
  title: String,
  description: String,
  status: {
    type: String,
    enum: ["pending", "in-progress", "completed"],
    default: "pending",
  },
  assignedTo: {
    type: String, // or mongoose.Schema.Types.ObjectId if using user model
    required: false,
  },
  priority: {
    type: String,
    enum: ["Low", "Medium", "High"],
    default: "Medium",
  },
}, { timestamps: true });

const Task = mongoose.models.Task || mongoose.model("Task", TaskSchema);

export default Task;
