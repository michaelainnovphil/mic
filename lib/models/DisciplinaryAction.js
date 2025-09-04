import mongoose from "mongoose";

const DisciplinaryActionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },
    action: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { collection: "disciplinary_actions" }
);

export default mongoose.models.DisciplinaryAction ||
  mongoose.model("DisciplinaryAction", DisciplinaryActionSchema);
