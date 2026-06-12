// routes/auth.routes.ts
import { Router } from "express";
import {
  login,
  register,
  changePassword,
  forgotPassword,
  resetPassword,
  refreshToken,
  logout,
  getCurrentUser,
} from "../controllers/auth.controller";
import { protect } from "../middlewares/auth.middleware";

const router = Router();

// Public routes
router.post("/login", login);
router.post("/register", register); // Admin only - add protect middleware if needed
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/refresh", refreshToken);
router.post("/logout", logout);

// Protected routes (require authentication)
router.get("/me", protect, getCurrentUser);
router.post("/change-password", protect, changePassword);

export default router;