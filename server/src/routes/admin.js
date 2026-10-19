import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { DEPARTMENTS } from "../config.js";
import { protect, allowRoles } from "../middleware/auth.js";

const router = express.Router();
router.use(protect, allowRoles("admin"));

router.get("/users", async (_req, res) => {
  const users = await User.find({ role: { $in: ["faculty", "hod"] } })
    .select("name email role department createdAt").sort({ role: 1, department: 1, name: 1 });
  res.json({ users });
});

router.post("/users", async (req, res) => {
  try {
    const { name, email, password, role, department } = req.body;
    if (!name?.trim() || !email?.trim() || !password || !role || !department) {
      return res.status(400).json({ message: "Name, email, password, role and department are required" });
    }
    if (!["faculty", "hod"].includes(role)) {
      return res.status(400).json({ message: "Admin can create Faculty or HOD accounts only" });
    }
    if (!DEPARTMENTS.includes(department)) return res.status(400).json({ message: "Choose a valid department" });
    if (password.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ message: "This email is already registered" });
    }
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: await bcrypt.hash(password, 12),
      role,
      department
    });
    res.status(201).json({
      message: `${role.toUpperCase()} account created successfully`,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, department: user.department }
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "This email is already registered" });
    console.error("Create staff error:", error.message);
    res.status(500).json({ message: "Could not create account" });
  }
});

export default router;
