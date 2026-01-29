import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import Court from "../models/court.model";
import { AppError } from "../errors/AppError";

/* =====================================================
   CREATE COURT
===================================================== */
export const createCourt = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const {
      name,
      level,
      magistrate,
      phone,
      primaryEmail,
      secondaryEmails,
      code,
      location,
    } = req.body;

    if (!name || !primaryEmail) {
      return next(
        new AppError("Court name and primary email are required", 400),
      );
    }

    const existing = await Court.findOne({ name: name.toUpperCase() });
    if (existing) {
      return next(new AppError("Court already exists", 409));
    }

    const court = await Court.create({
      name,
      level,
      magistrate,
      phone,
      primaryEmail,
      secondaryEmails,
      code,
      location,
    });

    res.status(201).json({
      status: "success",
      data: court,
    });
  } catch (err: any) {
    console.error("createCourt error:", err.message || err);
    next(err);
  }
};

/* =====================================================
   GET ALL COURTS
===================================================== */
export const getAllCourts = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const courts = await Court.find().sort({ name: 1 }).lean();

    res.status(200).json({
      status: "success",
      results: courts.length,
      data: courts,
    });
  } catch (err: any) {
    console.error("getAllCourts error:", err.message || err);
    next(err);
  }
};

/* =====================================================
   GET COURT BY ID
===================================================== */
export const getCourtById = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return next(new AppError("Invalid court ID", 400));
    }

    const court = await Court.findById(id).lean();

    if (!court) {
      return next(new AppError("Court not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: court,
    });
  } catch (err: any) {
    console.error("getCourtById error:", err.message || err);
    next(err);
  }
};

/* =====================================================
   UPDATE COURT
===================================================== */
export const updateCourt = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return next(new AppError("Invalid court ID", 400));
    }

    const updated = await Court.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) {
      return next(new AppError("Court not found", 404));
    }

    res.status(200).json({
      status: "success",
      data: updated,
    });
  } catch (err: any) {
    console.error("updateCourt error:", err.message || err);
    next(err);
  }
};

/* =====================================================
   DELETE COURT
===================================================== */
export const deleteCourt = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return next(new AppError("Invalid court ID", 400));
    }

    const deleted = await Court.findByIdAndDelete(id);

    if (!deleted) {
      return next(new AppError("Court not found", 404));
    }

    res.status(200).json({
      status: "success",
      message: "Court deleted successfully",
    });
  } catch (err: any) {
    console.error("deleteCourt error:", err.message || err);
    next(err);
  }
};
