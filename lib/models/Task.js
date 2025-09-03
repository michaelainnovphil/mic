// lib/models/Task.js
import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed"],
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


const Task = mongoose.models.Task || mongoose.model("Task", TaskSchema);

export default Task;
