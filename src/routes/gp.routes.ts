import { Router } from "express";
import {
  getGpProfile,
  getGpDashboard,
  createRejectionRecord,
  getAllRecordsForAdmin,
  getRecordById,
  updateRejection
} from "../controllers/gp.controller"; // Assuming your controller is named this
import { protect, restrictTo } from "../middlewares/auth.middleware";
import { UserRole } from "../models/User";
import { upload } from "../config/cloudinary";

const router = Router();

// 🔐 1. Authenticate ALL routes
router.use(protect);

/* =====================================
   ADMIN ONLY ROUTES
===================================== */
router.get(
  "/admin/all-records", 
  restrictTo(UserRole.ADMIN), 
  getAllRecordsForAdmin
);

/* =====================================
   GP ONLY ROUTES
===================================== */
// Dashboard: Get GP-specific records
router.get(
  "/dashboard", 
  restrictTo(UserRole.GP), 
  getGpDashboard
);

// Profile: Manage GP account details
router.get(
  "/profile", 
  restrictTo(UserRole.GP), 
  getGpProfile
);

// Create Rejection: (with file upload)
router.post(
  "/reject", 
  restrictTo(UserRole.GP), 
  upload.single("file"), 
  createRejectionRecord
);

/* =====================================
   SHARED ROUTES (Admin & GP)
===================================== */
// View specific record
router.get(
  "/:id", 
  restrictTo(UserRole.ADMIN, UserRole.GP), 
  getRecordById
);

// Update record (Used by GP to rectify, or Admin to edit)
router.put(
  "/update/:id", 
  restrictTo(UserRole.ADMIN, UserRole.GP), 
  updateRejection
);

export default router;