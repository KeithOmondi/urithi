import { Router } from "express";
// Imports from Record Controller
import {
  createRecord,
  updateRecord,
  getRecordById,
  getRecordsByCourt,
  updateMultipleRecordsDateForwarded,
} from "../controllers/record.controller";

// Imports from Admin Controller (based on your new code)
import {
  deleteRecord,
  getAnalytics,
  verifyRecords,
  getRecordsForAdmin,
} from "../controllers/admin.controller";

import { protect, restrictTo } from "../middlewares/auth.middleware";

const router = Router();

/**
 * Global Middleware: All routes require authentication
 */
router.use(protect);

// ==========================================
// ADMIN EXCLUSIVE ROUTES
// ==========================================
// These are restricted to the "admin" role only.
router.get("/admin/analytics", restrictTo("admin"), getAnalytics);
router.get("/admin/list", restrictTo("admin"), getRecordsForAdmin);
router.post("/admin/verify-bulk", restrictTo("admin"), verifyRecords);
router.delete("/admin/:id", restrictTo("admin"), deleteRecord);

// ==========================================
// REGISTRY & USER ROUTES
// ==========================================

// Bulk actions (Registry/Admin)
router.put("/bulk-forward", restrictTo("admin", "registry"), updateMultipleRecordsDateForwarded);

// Standard Record CRUD & Queries
router.post("/create", createRecord);
router.get("/court/:courtId", getRecordsByCourt);
router.get("/:id", getRecordById);
router.put("/:id", updateRecord);

export default router;