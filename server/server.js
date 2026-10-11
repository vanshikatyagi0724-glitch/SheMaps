import express from "express";
import cors from "cors";
import "dotenv/config";

import { issueDao } from "./db.js";
import {
  validateCreateIssue,
  validateIssueFilters,
  validateSupportRequest,
  validateStatusTransition,
} from "./validators.js";
import { HttpError, errorHandler, notFoundHandler } from "./errors.js";

const app = express();
const PORT = process.env.PORT || 5000;
const rawCorsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174";
const corsOrigins = rawCorsOrigin
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const ADMIN_KEY = process.env.ADMIN_KEY ? process.env.ADMIN_KEY.trim() : "";

// CORS configuration
app.use(
  cors({
    origin: corsOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-admin-key"],
    credentials: true,
  })
);

// JSON body parser with strict 100kb limit
app.use(express.json({ limit: "100kb" }));

// Optional admin authentication middleware for status updates
function requireAdminKeyIfConfigured(req, res, next) {
  if (ADMIN_KEY) {
    const providedKey = req.headers["x-admin-key"];
    if (!providedKey || providedKey !== ADMIN_KEY) {
      throw new HttpError(403, "Forbidden: invalid or missing x-admin-key header");
    }
  }
  next();
}

// Router for /api endpoints
const api = express.Router();

// 1. GET /api/health
api.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// 1b. GET /api/dashboard
api.get("/dashboard", (req, res, next) => {
  try {
    const data = issueDao.getDashboardData();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 2. GET /api/issues
api.get("/issues", (req, res, next) => {
  try {
    const filterValidation = validateIssueFilters(req.query);
    if (!filterValidation.valid) {
      throw new HttpError(400, "Invalid filter parameters", filterValidation.errors);
    }

    const issues = issueDao.getAll(filterValidation.filters);
    res.json(issues);
  } catch (err) {
    next(err);
  }
});

// 3. POST /api/issues
api.post("/issues", (req, res, next) => {
  try {
    const validation = validateCreateIssue(req.body);
    if (!validation.valid) {
      throw new HttpError(400, "Validation failed", validation.errors);
    }

    const createdIssue = issueDao.create(validation.cleaned);
    res.status(201).json(createdIssue);
  } catch (err) {
    next(err);
  }
});

// 4. PATCH /api/issues/:id/status
api.patch("/issues/:id/status", requireAdminKeyIfConfigured, (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, "Invalid issue ID format");
    }

    const existing = issueDao.getById(id);
    if (!existing) {
      throw new HttpError(404, "Issue not found");
    }

    const newStatus = req.body?.status;
    const note = typeof req.body?.note === "string" ? req.body.note.trim() : null;

    const transitionCheck = validateStatusTransition(existing.status, newStatus);
    if (!transitionCheck.valid) {
      throw new HttpError(transitionCheck.statusCode, transitionCheck.message);
    }

    const updatedIssue = issueDao.updateStatus(id, newStatus, note);
    res.json(updatedIssue);
  } catch (err) {
    next(err);
  }
});

// 5. POST /api/issues/:id/support
api.post("/issues/:id/support", (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, "Invalid issue ID format");
    }

    const validation = validateSupportRequest(req.body);
    if (!validation.valid) {
      throw new HttpError(400, "Validation failed", validation.errors);
    }

    const result = issueDao.support(id, validation.supporterId);

    if (result.notFound) {
      throw new HttpError(404, "Issue not found");
    }

    if (result.duplicate) {
      throw new HttpError(409, "Issue has already been supported by this supporter");
    }

    // Return 201 Created on new support recording
    res.status(201).json(result.issue);
  } catch (err) {
    next(err);
  }
});

// Mount /api router
app.use("/api", api);

// Catch-all 404 for undefined routes
app.use(notFoundHandler);

// Central error handling middleware
app.use(errorHandler);

// Start server
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`  SheMaps Backend Server running on port ${PORT}`);
    console.log(`  Health Check: http://localhost:${PORT}/api/health`);
    console.log(`  API Base:     http://localhost:${PORT}/api/issues`);
    console.log(`===============================================`);
  });
}

export default app;
