// routes/record.routes.ts
import { Router } from "express";
import {
  createRecord,
  updateRecord,
  deleteRecord,
  verifyRecords,
  getRecordById,
  getAllRecords,
  getRecordsForAdmin,
  getRecordStats,
  getRecordsByCourt,
  updateMultipleRecordsDateForwarded,
  getAnalytics,
} from "../controllers/record.controller";
import { protect, restrictTo } from "../middlewares/auth.middleware";

const router = Router();

// =====================
// RECORD ROUTES
// =====================

// Create a new record
router.post("/create", protect, createRecord);

router.get("/get", protect, getAllRecords);
router.get("/admin", protect, getRecordsForAdmin);
router.get("/stats", protect, getRecordStats);
router.get("/court/:courtId", protect, getRecordsByCourt);

// Update an existing record by ID
router.put("/update/:id", protect, updateRecord);

// Delete a record by ID
router.delete("/delete/:id", protect, restrictTo("admin"), deleteRecord);

//bulk update
router.put("/update-multiple-date-forwarded", protect, updateMultipleRecordsDateForwarded);

// Verify multiple records by IDs
router.post("/verify", protect, verifyRecords);

// Get a record by ID
router.get("/get/:id", protect, getRecordById);

router.get("/analytics", protect, restrictTo("admin"), getAnalytics);

export default router;
