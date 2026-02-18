import { Router } from "express";
import {
  getGpProfile,
  getGpDashboard,
  createRejectionRecord,
  getAllRecordsForAdmin,
  getRecordById,
  updateRejection,
  proxyFilePreview
} from "../controllers/gp.controller"; // Assuming your controller is named this
import { protect, restrictTo } from "../middlewares/auth.middleware";
import { upload } from "../config/cloudinary";

const router = Router();

// 🔐 1. Authenticate ALL routes
router.use(protect);

/* =====================================
   ADMIN ONLY ROUTES
===================================== */
router.get(
  "/admin/all-records", 
  restrictTo("admin"), 
  getAllRecordsForAdmin
);

/* =====================================
   GP ONLY ROUTES
===================================== */
// Dashboard: Get GP-specific records
router.get(
  "/dashboard", 
  restrictTo("gp"), 
  getGpDashboard
);

// Profile: Manage GP account details
router.get(
  "/profile", 
  restrictTo("gp"), 
  getGpProfile
);

// Create Rejection: (with file upload)
// Create Rejection: (with file upload & debug logs)
router.post(
  "/reject",
  restrictTo("gp"),
  upload.single("file"),
  createRejectionRecord
);



/* =====================================
   SHARED ROUTES (Admin & GP)
===================================== */
// View specific record
router.get(
  "/:id", 
  restrictTo("admin", "gp"), 
  getRecordById
);

// Update record (Used by GP to rectify, or Admin to edit)
router.put(
  "/update/:id", 
  restrictTo("gp"), 
  updateRejection
);


router.get("/admin/proxy-view/:id", restrictTo("admin", "gp"), proxyFilePreview);


export default router;