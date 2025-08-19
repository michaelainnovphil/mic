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
    assignedTo: [
      {
        type: String, // store user email or ObjectId if you have a User model
      },
    ],
    assignedToTeam: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium",
    },
    client: {
      type: String, // client name or ID
      required: false,
    },
  },
  { timestamps: true }
);

const Task = mongoose.models.Task || mongoose.model("Task", TaskSchema);

export default Task;
