// lib/models/Task.js
import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    status: {
      type: String,
      enum: ["pending", "in-progress", "on-hold", "completed"],
      default: "pending",
    },
    assignedTo: [{ type: String }],
    assignedToTeam: { type: Boolean, default: false },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    client: { type: String },
    createdBy: { type: String, required: true },

    startTime: { type: Date },
    endTime: { type: Date },
    duration: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Add indexes for faster queries
TaskSchema.index({ assignedTo: 1 });
TaskSchema.index({ createdBy: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ createdAt: -1 });
TaskSchema.index({ assignedTo: 1, status: 1 });
TaskSchema.index({ createdBy: 1, status: 1 });

const Task = mongoose.models.Task || mongoose.model("Task", TaskSchema);

export default Task;
