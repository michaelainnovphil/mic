import mongoose from "mongoose";

const ShiftSchema = new mongoose.Schema({
  userId: String,
  displayName: String,
  startDateTime: Date,
  endDateTime: Date,
  team: String,
}, { timestamps: true });

export default mongoose.models.Shift || mongoose.model("Shift", ShiftSchema);
