import mongoose from "mongoose";
import { DEPARTMENTS } from "../config.js";

const applicationSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  type: { type: String, required: true, trim: true },
  reason: { type: String, required: true, trim: true },
  department: { type: String, enum: DEPARTMENTS, required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  faculty: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  hod: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  status: {
    type: String,
    enum: ["Submitted", "Forwarded to HOD", "Approved", "Rejected"],
    default: "Submitted"
  },
  facultyNote: { type: String, default: "" },
  hodNote: { type: String, default: "" },
  forwardedAt: { type: Date, default: null },
  decidedAt: { type: Date, default: null }
}, { timestamps: true });

export default mongoose.model("Application", applicationSchema);
