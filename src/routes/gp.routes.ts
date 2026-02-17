import { Router } from "express";
import {
  getGpProfile,
  getGpDashboard,
  createRejectionRecord,
} from "../controllers/gp.controller";
import { protect, restrictTo } from "../middlewares/auth.middleware";
import { UserRole } from "../models/User";
import { upload } from "../config/cloudinary";

const router = Router();

/**
 * 🔐 ALL routes below require authentication and the 'gp' role
 */
router.use(protect);
router.use(restrictTo(UserRole.GP));

// 🔹 Dashboard: Get GP-specific records
router.get("/dashboard", getGpDashboard);

// 🔹 Profile: Manage GP account details
router.get("/profile", getGpProfile);

// 🔹 Rejections: Create a new compliance rejection (with file upload)
// 'file' must match the key used in your frontend FormData.append("file", ...)
router.post("/reject", upload.single("file"), createRejectionRecord);

export default router;