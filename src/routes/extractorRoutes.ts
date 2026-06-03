import express from "express";
import { ExtractorController } from "../controllers/extractorController";

// ✅ Use diskUpload explicitly — makes intent clear
import { diskUpload } from "../middlewares/upload";

const router = express.Router();

router.post(
  "/extract",
  diskUpload.single("pdf"),
  ExtractorController.uploadAndExtract
);

router.get("/jobs", ExtractorController.getAllJobs);
router.get("/jobs/stats", ExtractorController.getStats);
router.get("/jobs/:id", ExtractorController.getJobById);
router.get("/jobs/:jobId/search", ExtractorController.searchRecords);
router.get("/jobs/:id/export", ExtractorController.exportAsCSV);

export default router;