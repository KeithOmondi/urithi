import { Router } from "express";
import {
  createCourt,
  getAllCourts,
  getCourtById,
  updateCourt,
  deleteCourt,
} from "../controllers/court.controller";
import { protect, restrictTo } from "../middlewares/auth.middleware";

const router = Router();

// CRUD
router.post("/create", protect, restrictTo("admin"), createCourt);
router.get("/get", protect, getAllCourts);
router.get("/get/:id", protect, getCourtById);
router.put("/update/:id", protect, restrictTo("admin"), updateCourt);
router.delete("/delete/:id", protect, restrictTo("admin"), deleteCourt);

export default router;
