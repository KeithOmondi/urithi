import express from "express";
import { protect } from "../middlewares/auth.middleware";
import { scanGazette } from "../controllers/gazetteScanner.controller";
import { upload } from "../middlewares/upload";

const router = express.Router();

/**
 * @route   POST /api/gazettes/scan
 * @desc    Upload and scan a Gazette PDF
 * @access  Private
 */
router.post(
  "/scan", 
  protect, 
  upload.single("file"), // "file" must match the key in your Postman/Frontend request
  scanGazette
);

// Add these placeholders for the other functions we discussed earlier
// router.get("/", protect, getGazettes);
// router.get("/:id", protect, getGazetteDetails);
// router.get("/logs", protect, getScanLogs);

export default router;