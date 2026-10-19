
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";

import Application from "../models/Application.js";
import User from "../models/User.js";
import { DEPARTMENTS } from "../config.js";
import { protect, allowRoles } from "../middleware/auth.js";

const router = express.Router();

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error("Only PDF, JPG, and PNG files are allowed.")
      );
    }

    callback(null, true);
  },
});

function handleUpload(req, res, next) {
  upload.single("attachment")(req, res, (error) => {
    if (!error) return next();

    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? "File size must not exceed 5 MB."
          : error.message;

      return res.status(400).json({ message });
    }

    return res.status(400).json({
      message: error.message || "Unable to upload attachment.",
    });
  });
}

const populatedApplication = [
  {
    path: "student",
    select: "name email department rollNo",
  },
  {
    path: "faculty",
    select: "name email department",
  },
  {
    path: "hod",
    select: "name email department",
  },
];

function validId(id) {
  return mongoose.isValidObjectId(id);
}

function publicVerificationUrl(id) {
  const apiBase = (
    process.env.PUBLIC_API_URL ||
    "https://smartapplybackend.vercel.app/api"
  ).replace(/\/$/, "");

  return `${apiBase}/applications/${id}/verify`;
}

// PUBLIC ROUTE: Keep this BEFORE router.use(protect).
// Scanning the QR code opens this endpoint without a login.
router.get("/:id/verify", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({
        valid: false,
        message: "Invalid application ID.",
      });
    }

    const application = await Application.findById(req.params.id)
      .populate("student", "name rollNo department")
      .populate("faculty", "name")
      .populate("hod", "name");

    if (!application || application.status !== "Approved") {
      return res.status(404).json({
        valid: false,
        message: "No approved application found for this QR code.",
      });
    }

    return res.json({
      valid: true,
      message: "Verified: this application is approved in SmartApply.",
      application: {
        id: application._id,
        title: application.title,
        type: application.type,
        department: application.department,
        studentName: application.student?.name || "",
        rollNo: application.student?.rollNo || "",
        status: application.status,
        approvedAt: application.decidedAt,
        approvedBy: application.hod?.name || "",
      },
    });
  } catch (error) {
    console.error("QR verification error:", error);

    return res.status(500).json({
      valid: false,
      message: "Unable to verify this application.",
    });
  }
});

// All routes below this point require authentication.
router.use(protect);

// Get faculty and HOD options for the student's department.
router.get("/staff", allowRoles("student", "admin"), async (req, res) => {
  try {
    const department = req.query.department;

    if (!department || !DEPARTMENTS.includes(department)) {
      return res.status(400).json({
        message: "A valid department is required.",
      });
    }

    const staff = await User.find({
      department,
      role: { $in: ["faculty", "hod"] },
    }).select("name email role department");

    return res.json({ staff });
  } catch (error) {
    console.error("Staff lookup error:", error);

    return res.status(500).json({
      message: "Unable to load staff.",
    });
  }
});

// Submit a new student application with an optional attachment.
router.post(
  "/",
  allowRoles("student"),
  handleUpload,
  async (req, res) => {
    try {
      const { title, type, reason, department, facultyId } = req.body;

      if (
        !title?.trim() ||
        !type?.trim() ||
        !reason?.trim() ||
        !department ||
        !facultyId
      ) {
        return res.status(400).json({
          message:
            "Title, type, reason, department and faculty are required.",
        });
      }

      if (!DEPARTMENTS.includes(department)) {
        return res.status(400).json({
          message: "Invalid department.",
        });
      }

      if (!validId(facultyId)) {
        return res.status(400).json({
          message: "Invalid faculty selection.",
        });
      }

      const student = await User.findById(req.user.id);

      if (!student) {
        return res.status(401).json({
          message: "Student account not found.",
        });
      }

      if (student.department !== department) {
        return res.status(400).json({
          message: "Application department must match your department.",
        });
      }

      const faculty = await User.findOne({
        _id: facultyId,
        role: "faculty",
        department,
      });

      if (!faculty) {
        return res.status(400).json({
          message: "Select a valid faculty member from your department.",
        });
      }

      const attachment = req.file
        ? {
            fileName: req.file.originalname,
            contentType: req.file.mimetype,
            data: req.file.buffer.toString("base64"),
          }
        : undefined;

      const application = await Application.create({
        title: title.trim(),
        type: type.trim(),
        reason: reason.trim(),
        department,
        student: student._id,
        faculty: faculty._id,
        attachment,
      });

      await application.populate(populatedApplication);

      return res.status(201).json({
        message: "Application submitted successfully.",
        application,
      });
    } catch (error) {
      console.error("Application submission error:", error);

      return res.status(500).json({
        message: "Unable to submit application.",
      });
    }
  }
);

// List applications according to the logged-in user's role.
router.get("/", async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "student") {
      filter.student = req.user.id;
    } else if (req.user.role === "faculty") {
      filter.faculty = req.user.id;
    } else if (req.user.role === "hod") {
      filter.hod = req.user.id;
    } else if (req.user.role !== "admin") {
      return res.status(403).json({
        message: "You are not allowed to view applications.",
      });
    }

    const applications = await Application.find(filter)
      .populate(populatedApplication)
      .sort({ createdAt: -1 });

    return res.json({ applications });
  } catch (error) {
    console.error("Application list error:", error);

    return res.status(500).json({
      message: "Unable to load applications.",
    });
  }
});

// Download the original supporting attachment, if present.
router.get("/:id/attachment", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: "Invalid application ID." });
    }

    const application = await Application.findById(req.params.id);

    if (!application) {
      return res.status(404).json({ message: "Application not found." });
    }

    const userId = String(req.user.id);
    const isOwner = String(application.student) === userId;
    const isAssignedFaculty = String(application.faculty) === userId;
    const isAssignedHod = String(application.hod) === userId;

    if (
      req.user.role !== "admin" &&
      !isOwner &&
      !isAssignedFaculty &&
      !isAssignedHod
    ) {
      return res.status(403).json({
        message: "You cannot access this attachment.",
      });
    }

    if (!application.attachment?.data) {
      return res.status(404).json({
        message: "No attachment was uploaded.",
      });
    }

    const buffer = Buffer.from(application.attachment.data, "base64");
    const contentType =
      application.attachment.contentType || "application/octet-stream";
    const fileName = (application.attachment.fileName || "attachment")
      .replace(/[\r\n"]/g, "_");

    res.setHeader("Content-Type", contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${fileName}"`
    );

    return res.send(buffer);
  } catch (error) {
    console.error("Attachment download error:", error);

    return res.status(500).json({
      message: "Unable to download attachment.",
    });
  }
});

// Generate a PDF only after HOD approval.
router.get("/:id/pdf", async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: "Invalid application ID." });
    }

    const application = await Application.findById(req.params.id)
      .populate("student", "name email department rollNo")
      .populate("faculty", "name email")
      .populate("hod", "name email");

    if (!application) {
      return res.status(404).json({ message: "Application not found." });
    }

    const isOwner = String(application.student?._id) === String(req.user.id);

    if (!isOwner && req.user.role !== "admin") {
      return res.status(403).json({
        message: "Only the student who submitted this application or an admin can download its PDF.",
      });
    }

    if (application.status !== "Approved") {
      return res.status(400).json({
        message: "The PDF is available only after HOD approval.",
      });
    }

    const verifyUrl = publicVerificationUrl(application._id);
    const qrBuffer = await QRCode.toBuffer(verifyUrl, {
      type: "png",
      width: 220,
      margin: 1,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="SmartApply-${application._id}.pdf"`
    );

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: "SmartApply Approved Application",
        Author: "SmartApply",
      },
    });

    doc.on("error", (error) => {
      console.error("PDF stream error:", error);
      if (!res.headersSent) res.status(500);
      res.end();
    });

    doc.pipe(res);

    doc.fontSize(22).text("SmartApply", { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(16).text("Approved Application Document", {
      align: "center",
    });

    doc.moveDown(1.5);
    doc.fontSize(11);

    const fields = [
      ["Application ID", String(application._id)],
      ["Title", application.title],
      ["Request Type", application.type],
      ["Student Name", application.student?.name || "N/A"],
      ["Roll Number", application.student?.rollNo || "Not provided"],
      ["Email", application.student?.email || "N/A"],
      ["Department", application.department],
      ["Assigned Faculty", application.faculty?.name || "N/A"],
      ["Approving HOD", application.hod?.name || "N/A"],
      ["Status", application.status],
      [
        "Submitted On",
        application.createdAt
          ? new Date(application.createdAt).toLocaleString("en-IN")
          : "N/A",
      ],
      [
        "Approved On",
        application.decidedAt
          ? new Date(application.decidedAt).toLocaleString("en-IN")
          : "N/A",
      ],
    ];

    for (const [label, value] of fields) {
      doc.font("Helvetica-Bold").text(`${label}: `, {
        continued: true,
      });
      doc.font("Helvetica").text(String(value));
      doc.moveDown(0.4);
    }

    doc.moveDown(0.7);
    doc.font("Helvetica-Bold").text("Reason:");
    doc.moveDown(0.3);
    doc.font("Helvetica").text(application.reason || "N/A");

    if (application.hodNote) {
      doc.moveDown(0.7);
      doc.font("Helvetica-Bold").text("HOD Note:");
      doc.moveDown(0.3);
      doc.font("Helvetica").text(application.hodNote);
    }

    doc.moveDown(1.2);
    doc.font("Helvetica-Bold").text("QR Verification", {
      align: "center",
    });
    doc.moveDown(0.4);
    doc.image(qrBuffer, {
      fit: [130, 130],
      align: "center",
    });
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(8).text(
      "Scan this QR code to check the approval status in SmartApply.",
      { align: "center" }
    );
    doc.moveDown(0.3);
    doc.text(verifyUrl, { align: "center" });

    doc.end();
  } catch (error) {
    console.error("PDF generation error:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        message: "Unable to generate the approved PDF.",
      });
    }

    return res.end();
  }
});

// Faculty forwards a submitted application to the HOD.
router.post("/:id/forward", allowRoles("faculty"), async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: "Invalid application ID." });
    }

    const application = await Application.findOne({
      _id: req.params.id,
      faculty: req.user.id,
      status: "Submitted",
    });

    if (!application) {
      return res.status(404).json({
        message: "Submitted application not found for this faculty member.",
      });
    }

    const hod = await User.findOne({
      role: "hod",
      department: application.department,
    });

    if (!hod) {
      return res.status(400).json({
        message: "No HOD is configured for this department.",
      });
    }

    application.hod = hod._id;
    application.facultyNote = req.body?.note?.trim() || "";
    application.status = "Forwarded to HOD";
    application.forwardedAt = new Date();

    await application.save();
    await application.populate(populatedApplication);

    return res.json({
      message: "Application forwarded to HOD.",
      application,
    });
  } catch (error) {
    console.error("Forward application error:", error);

    return res.status(500).json({
      message: "Unable to forward application.",
    });
  }
});

// HOD approves or rejects an application forwarded to them.
router.post("/:id/decision", allowRoles("hod"), async (req, res) => {
  try {
    if (!validId(req.params.id)) {
      return res.status(400).json({ message: "Invalid application ID." });
    }

    const { decision, note } = req.body;

    if (!["Approved", "Rejected"].includes(decision)) {
      return res.status(400).json({
        message: 'Decision must be "Approved" or "Rejected".',
      });
    }

    const application = await Application.findOne({
      _id: req.params.id,
      hod: req.user.id,
      status: "Forwarded to HOD",
    });

    if (!application) {
      return res.status(404).json({
        message: "Forwarded application not found for this HOD.",
      });
    }

    application.status = decision;
    application.hodNote = note?.trim() || "";
    application.decidedAt = new Date();

    await application.save();
    await application.populate(populatedApplication);

    return res.json({
      message: `Application ${decision.toLowerCase()}.`,
      application,
    });
  } catch (error) {
    console.error("HOD decision error:", error);

    return res.status(500).json({
      message: "Unable to update application decision.",
    });
  }
});

export default router;
