import { Router } from "express";
import { getMonthlyAnalytics } from "../controllers/analytics.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.get("/monthly", protect, getMonthlyAnalytics);

export default router;