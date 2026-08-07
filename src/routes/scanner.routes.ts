import { Router } from "express";
import { protect, restrictTo } from "../middlewares/auth.middleware";
import {
  previewScan,
  confirmScan,
  scanAndPublish,
} from "../controllers/scanner.controller";

// ✅ Import from cloudinary.ts (memory storage, 50MB limit)
// ❌ Never import from middlewares/upload.ts (disk storage)
import { upload } from "../config/cloudinary";

const router = Router();

router.use(protect, restrictTo("admin", "user"));

router.post("/scan/preview", upload.single("gazette"), previewScan);
router.post("/scan/confirm", confirmScan);
router.post("/scan", upload.single("gazette"), scanAndPublish);

export default router;