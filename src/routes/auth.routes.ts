// routes/auth.routes.ts
import { Router } from "express";
import {
  login,
  refreshToken,
  logout,
  verifyOtp,
} from "../controllers/auth.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

router.post("/login", login);
router.post("/verify-otp", verifyOtp);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);

export default router;
