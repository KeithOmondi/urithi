import { Request, Response } from "express";
import { User } from "../models/User";

/* =====================================
   GET GP DASHBOARD
===================================== */
export const getGpDashboard = async (
  req: Request & { user?: any },
  res: Response
) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.user.role !== "gp") {
    return res
      .status(403)
      .json({ message: "Only GP users can access this resource" });
  }

  return res.status(200).json({
    success: true,
    message: "GP dashboard loaded successfully",
    data: {
      gpId: req.user.id,
    },
  });
};

/* =====================================
   GET GP PROFILE
===================================== */
export const getGpProfile = async (
  req: Request & { user?: any },
  res: Response
) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const gp = await User.findById(req.user.id).select("-otp -otpExpires");

  if (!gp) {
    return res.status(404).json({ message: "GP not found" });
  }

  return res.status(200).json({
    success: true,
    data: gp,
  });
};

/* =====================================
   UPDATE GP PROFILE
===================================== */
export const updateGpProfile = async (
  req: Request & { user?: any },
  res: Response
) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { firstName, lastName, email } = req.body;

  const updatedGp = await User.findByIdAndUpdate(
    req.user.id,
    { firstName, lastName, email },
    { new: true, runValidators: true }
  ).select("-otp -otpExpires");

  if (!updatedGp) {
    return res.status(404).json({ message: "GP not found" });
  }

  return res.status(200).json({
    success: true,
    message: "Profile updated successfully",
    data: updatedGp,
  });
};

/* =====================================
   GET ALL GPS (ADMIN USE)
===================================== */
export const getAllGps = async (_req: Request, res: Response) => {
  const gps = await User.find({ role: "gp" }).select("-otp -otpExpires");

  return res.status(200).json({
    success: true,
    count: gps.length,
    data: gps,
  });
};
