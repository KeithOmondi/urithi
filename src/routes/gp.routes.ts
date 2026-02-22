import { Router } from "express";
import {
  getGpProfile,
  getGpDashboard,
  createRejectionRecord,
  getAllRecordsForAdmin,
  getRecordById,
  updateRejection,
  proxyFilePreview,
  lookupDeceasedName
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
  protect,
  restrictTo("admin"), 
  getAllRecordsForAdmin
);

/* =====================================
   GP ONLY ROUTES
===================================== */
// Dashboard: Get GP-specific records
router.get(
  "/dashboard", 
  protect,
  restrictTo("gp"), 
  getGpDashboard
);

// Profile: Manage GP account details
router.get(
  "/profile", 
  protect,
  restrictTo("gp"), 
  getGpProfile
);

// Create Rejection: (with file upload)
// Create Rejection: (with file upload & debug logs)
router.post(
  "/reject",
  protect,
  restrictTo("gp"),
  upload.single("file"),
  createRejectionRecord
);



/* =====================================
   SHARED ROUTES (Admin & GP)
===================================== */
// View specific record
router.get(
  "/lookup", 
  protect, 
  restrictTo("admin", "gp"), 
  lookupDeceasedName
);  


router.get(
  "/:id", 
  protect,
  restrictTo("admin", "gp"), 
  getRecordById
);

// Update record (Used by GP to rectify, or Admin to edit)
router.put(
  "/update/:id", 
  protect,
  restrictTo("gp"), 
  updateRejection
);


router.get("/admin/proxy-view/:id", protect, restrictTo("admin", "gp"), proxyFilePreview);

export default router;