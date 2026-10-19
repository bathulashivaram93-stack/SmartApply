
import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dns from "node:dns";

import User from "./models/User.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from "./routes/admin.js";
import applicationRoutes from "./routes/applications.js";

dns.setServers(["8.8.8.8"]);

const app = express();
const PORT = process.env.PORT || 5000;

// Allow requests from the local frontend and deployed Vercel frontend.
const allowedOrigins = [
  "http://localhost:5173",
  "https://smart-apply-c4hebvxfq-shiva-6062.vercel.app",
];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json({ limit: "1mb" }));

// Connect to MongoDB once per running serverless instance.
let dbPromise;

async function connectDB() {
  if (!process.env.MONGO_URI) {
    throw new Error("Missing MONGO_URI environment variable");
  }

  if (!process.env.JWT_SECRET) {
    throw new Error("Missing JWT_SECRET environment variable");
  }

  if (mongoose.connection.readyState === 1) {
    return;
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = (async () => {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected successfully");

    // Create the default admin if it does not exist.
    const email = "admin@gmail.com";
    const existingAdmin = await User.findOne({ email });

    if (!existingAdmin) {
      await User.create({
        name: "SmartApply Admin",
        email,
        password: await bcrypt.hash("admin123", 12),
        role: "admin",
        department: null,
      });

      console.log("Default admin created");
    }
  })().catch((error) => {
    dbPromise = null;
    throw error;
  });

  return dbPromise;
}

// Health check: verifies that the API is responding.
// This does not guarantee MongoDB is connected.
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "SmartApply API",
  });
});

// Ensure MongoDB is ready before handling application API requests.
app.use(async (_req, _res, next) => {
  try {
    await connectDB();
    next();
  } catch (error) {
    next(error);
  }
});

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/applications", applicationRoutes);

// Error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled API error:", err.message);

  res.status(500).json({
    message: "Unexpected server error",
  });
});

// Export the Express app for Vercel.
export default app;

// Start a local HTTP server outside Vercel.
if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`SmartApply API listening on ${PORT}`);
  });
}
