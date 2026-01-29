import { Request, Response } from "express";
import { User } from "../models/User";

/**
 * LOCAL TYPE EXTENSION
 * This tells TypeScript exactly what is inside 'req' after the 
 * 'protect' middleware has run, stopping the TSError crash.
 */
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

/* =====================================
   USER: GET OWN PROFILE
===================================== */
export const getMyProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      status: "success",
      data: user,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   USER: UPDATE OWN PROFILE
===================================== */
export const updateMyProfile = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { firstName, lastName, email } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { firstName, lastName, email },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: user,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   ADMIN: CREATE USER
===================================== */
export const createUser = async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, email, pjNumber, password, role } = req.body;

    const newUser = await User.create({
      firstName,
      lastName,
      email,
      pjNumber,
      password,
      role,
      isActive: true,
    });

    res.status(201).json({
      status: "success",
      data: newUser,
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

/* =====================================
   ADMIN: GET ALL USERS
===================================== */
export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      results: users.length,
      data: users,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   ADMIN: GET SINGLE USER BY ID
===================================== */
export const getUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      status: "success",
      data: user,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   ADMIN: UPDATE USER DETAILS
===================================== */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      status: "success",
      data: updatedUser,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   ADMIN: TOGGLE ACTIVE STATUS
===================================== */
export const toggleUserStatus = async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.status(200).json({
      status: "success",
      message: `User has been ${user.isActive ? "activated" : "deactivated"}`,
      data: user,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

/* =====================================
   ADMIN: PERMANENT DELETE
===================================== */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};