import { Router } from "express";
import {
  getGpProfile,
  getGpDashboard,
  createRejectionRecord,
  getAllRecordsForAdmin,
  getRecordById,
  updateRejection
} from "../controllers/gp.controller";
import { protect, restrictTo } from "../middlewares/auth.middleware";
import { upload } from "../config/cloudinary";

const router = Router();

// 🔐 Authenticate all routes
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
// Dashboard: GP-specific records
router.get(
  "/dashboard", 
  restrictTo("gp"), 
  getGpDashboard
);

// Profile: GP details
router.get(
  "/profile", 
  restrictTo("gp"), 
  getGpProfile
);

// Create Rejection: GP only, with Cloudinary upload
router.post(
  "/reject", 
  restrictTo("gp"), 
  upload.single("file"), 
  async (req, res, next) => {
    try {
      // Cloudinary URL is already in req.file.path thanks to CloudinaryStorage
      if (!req.file) {
        return res.status(400).json({ message: "File is required" });
      }

      return createRejectionRecord(req, res);
    } catch (err: any) {
      return res.status(500).json({ message: err.message });
    }
  }
);

/* =====================================
   SHARED ROUTES
===================================== */
// Fetch single record (Admin & GP)
router.get(
  "/:id", 
  restrictTo("admin", "gp"), 
  getRecordById
);

// Update record (GP rectification)
router.put(
  "/update/:id", 
  restrictTo("gp"), 
  updateRejection
);

export default router;
