import express from "express";
import Application from "../models/Application.js";
import User from "../models/User.js";
import { DEPARTMENTS } from "../config.js";
import { protect, allowRoles } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);

const populated = [
  { path: "student", select: "name email department" },
  { path: "faculty", select: "name email department" },
  { path: "hod", select: "name email department" }
];

router.get("/staff", async (req, res) => {
  if (!["student", "admin"].includes(req.user.role)) return res.status(403).json({ message: "Not allowed" });
  const department = req.query.department;
  if (!DEPARTMENTS.includes(department)) return res.status(400).json({ message: "Choose a valid department" });
  const staff = await User.find({ role: { $in: ["faculty", "hod"] }, department })
    .select("name email role department").sort({ name: 1 });
  res.json({ staff });
});

router.post("/", allowRoles("student"), async (req, res) => {
  try {
    const { title, type, reason, department, facultyId } = req.body;
    if (!title?.trim() || !type?.trim() || !reason?.trim() || !department || !facultyId) {
      return res.status(400).json({ message: "Complete all application fields" });
    }
    if (!DEPARTMENTS.includes(department)) return res.status(400).json({ message: "Choose a valid department" });
    const faculty = await User.findOne({ _id: facultyId, role: "faculty", department });
    if (!faculty) return res.status(400).json({ message: "Select a faculty member from the chosen department" });

    const application = await Application.create({
      title: title.trim(),
      type: type.trim(),
      reason: reason.trim(),
      department,
      student: req.user._id,
      faculty: faculty._id
    });
    await application.populate(populated);
    res.status(201).json({ message: "Application submitted to faculty successfully", application });
  } catch (error) {
    console.error("Submit application error:", error.message);
    res.status(500).json({ message: "Could not submit application" });
  }
});

router.get("/", async (req, res) => {
  let filter = {};
  if (req.user.role === "student") filter.student = req.user._id;
  else if (req.user.role === "faculty") filter.faculty = req.user._id;
  else if (req.user.role === "hod") filter.hod = req.user._id;
  else if (req.user.role !== "admin") return res.status(403).json({ message: "Not allowed" });

  const applications = await Application.find(filter).populate(populated).sort({ createdAt: -1 });
  res.json({ applications });
});

router.post("/:id/forward", allowRoles("faculty"), async (req, res) => {
  try {
    const application = await Application.findOne({
      _id: req.params.id,
      faculty: req.user._id,
      status: "Submitted"
    });
    if (!application) return res.status(404).json({ message: "Application not found or already processed" });

    const hod = await User.findOne({ role: "hod", department: application.department });
    if (!hod) return res.status(400).json({ message: `No HOD account exists for ${application.department}. Ask admin to create one.` });

    application.hod = hod._id;
    application.facultyNote = String(req.body.note || "").trim();
    application.status = "Forwarded to HOD";
    application.forwardedAt = new Date();
    await application.save();
    await application.populate(populated);
    res.json({ message: "Application forwarded to the department HOD", application });
  } catch (error) {
    console.error("Forward application error:", error.message);
    res.status(500).json({ message: "Could not forward application" });
  }
});

router.post("/:id/decision", allowRoles("hod"), async (req, res) => {
  try {
    const { decision, note = "" } = req.body;
    if (!["Approved", "Rejected"].includes(decision)) {
      return res.status(400).json({ message: "Decision must be Approved or Rejected" });
    }
    const application = await Application.findOne({
      _id: req.params.id,
      hod: req.user._id,
      status: "Forwarded to HOD"
    });
    if (!application) return res.status(404).json({ message: "Forwarded application not found" });

    application.status = decision;
    application.hodNote = String(note).trim();
    application.decidedAt = new Date();
    await application.save();
    await application.populate(populated);
    res.json({ message: `Application ${decision.toLowerCase()}`, application });
  } catch (error) {
    console.error("HOD decision error:", error.message);
    res.status(500).json({ message: "Could not update application" });
  }
});

export default router;
