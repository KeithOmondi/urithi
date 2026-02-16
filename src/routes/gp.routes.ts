import { Router } from "express";
import {
  getGpDashboard,
  getGpProfile,
  updateGpProfile,
} from "../controllers/gp.controller";
import { protect, restrictTo } from "../middlewares/auth.middleware";
import { UserRole } from "../models/User";

const router = Router();

router.use(protect, restrictTo(UserRole.GP));

router.get("/dashboard", getGpDashboard);
router.get("/profile", getGpProfile);
router.patch("/profile", updateGpProfile);

export default router;
