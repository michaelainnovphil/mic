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
    // Multiple user IDs for specific assignments
    assignedTo: [
      {
        type: String, // or mongoose.Schema.Types.ObjectId if linking to a User model
      },
    ],
    // If true, applies to an entire team (manager’s team)
    assignedToTeam: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
  },
  { timestamps: true }
);

const Task =
  mongoose.models.Task || mongoose.model("Task", TaskSchema);

export default Task;
