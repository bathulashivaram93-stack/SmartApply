
import mongoose from "mongoose";
import { DEPARTMENTS, ROLES } from "../config.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ROLES,
      required: true,
    },
    department: {
      type: String,
      enum: DEPARTMENTS,
      default: null,
    },
    rollNo: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
    },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
