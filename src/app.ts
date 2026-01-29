import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import { notFound } from "./errors/notFound";
import { errorHandler } from "./errors/errorHandler";
import { getSystemMetrics, isDatabaseReady } from "./config/health";
import authRoutes from "./routes/auth.routes";
import recordRoutes from "./routes/record.routes";
import courtRoutes from "./routes/court.routes";
import reportRoutes from "./routes/report.routes";
import userRoutes from "./routes/user.routes";
import scanRoutes from "./routes/scan.routes"
import { env } from "./config/env";

const app = express();

/* =====================================
   MIDDLEWARE
===================================== */

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  }),
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


/* =====================================
   ROOT
===================================== */

app.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "🚀 API is running",
  });
});

/* =====================================
   ROUTES
===================================== */

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/records", recordRoutes);
app.use("/api/v1/courts", courtRoutes);
app.use("/api/v1/reports", reportRoutes);
app.use("/api/v1/user", userRoutes);
app.use("/api/v1/gazette", scanRoutes);

/* =====================================
   HEALTH CHECKS
===================================== */

// Liveness probe
app.get("/health/live", (_req, res) => {
  res.status(200).json({
    status: "alive",
    ...getSystemMetrics(),
  });
});

// Readiness probe
app.get("/health/ready", (_req, res) => {
  const dbReady = isDatabaseReady();

  if (!dbReady) {
    return res.status(503).json({
      status: "not_ready",
      reason: "Database not connected",
      ...getSystemMetrics(),
    });
  }

  res.status(200).json({
    status: "ready",
    database: "connected",
    ...getSystemMetrics(),
  });
});

// Aggregated health
app.get("/health", (_req, res) => {
  const dbReady = isDatabaseReady();

  res.status(200).json({
    status: dbReady ? "ready" : "degraded",
    database: dbReady ? "connected" : "disconnected",
    ...getSystemMetrics(),
  });
});

/* =====================================
   ERRORS
===================================== */

app.use(notFound);
app.use(errorHandler);

export default app;
