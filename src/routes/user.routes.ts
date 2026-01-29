import { Router } from "express";
import * as userController from "../controllers/user.controller";
import { protect, restrictTo } from "../middlewares/auth.middleware";

const router = Router();

router.get("/me", protect, userController.getMyProfile);
router.patch("/updateMe", protect, userController.updateMyProfile);

router.get("/get", protect, restrictTo("admin"), userController.getAllUsers); // List all users
router.post("/create", protect, restrictTo("admin"), userController.createUser); // Admin manually creates a user

router.get("/get/:id", protect, restrictTo("admin"), userController.getUser); // View specific user
router.patch(
  "/update/:id",
  protect,
  restrictTo("admin"),
  userController.updateUser,
); // Update specific user details
router.delete(
  "/delete/:id",
  protect,
  restrictTo("admin"),
  userController.deleteUser,
); // Permanent removal

router.patch(
  "/toggle-status/:userId",
  protect,
  restrictTo("admin"),
  userController.toggleUserStatus,
);

export default router;
