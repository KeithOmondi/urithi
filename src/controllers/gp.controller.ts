import { Request, Response } from "express";
import { User } from "../models/User";
import Rejection from "../models/go.model";

interface CustomRequest extends Request {
  user?: any;
  file?: any;
}

/* =====================================
   GET GP PROFILE
===================================== */
export const getGpProfile = async (req: CustomRequest, res: Response) => {
  try {
    // Here 'User' is used. If this function is deleted,
    // the import at the top will throw the ts(6133) error.
    const gp = await User.findById(req.user.id)
      .select("-otp -otpExpires")
      .lean();

    if (!gp) return res.status(404).json({ message: "GP not found" });
    return res.status(200).json(gp);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

/* =====================================
   GET GP DASHBOARD
===================================== */
export const getGpDashboard = async (req: CustomRequest, res: Response) => {
  try {
    const records = await Rejection.find({ updatedBy: req.user.id })
      .populate("courtStation", "name level")
      .sort({ createdAt: -1 })
      .lean();

    // Matching the Redux interface: { gpId, records }
    return res.status(200).json({
      gpId: req.user.id,
      records,
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

/* =====================================
   CREATE REJECTION RECORD
===================================== */
export const createRejectionRecord = async (
  req: CustomRequest,
  res: Response,
) => {
  try {
    const { causeNo, rejectionReason, dateOfRejection } = req.body;

    if (!causeNo || !rejectionReason || !req.file) {
      return res
        .status(400)
        .json({ message: "Missing required fields or file" });
    }

    const createdRejection = await Rejection.create({
      causeNo: causeNo.toUpperCase().trim(),
      rejectionReason,
      dateReceived: dateOfRejection || new Date(),
      fileUrl: req.file.path,
      courtStation: req.user.courtStation,
      updatedBy: req.user.id,
      lastEditAction: "Created rejection record",
    });

    const populated = await Rejection.findById(createdRejection._id)
      .populate("updatedBy", "firstName lastName pjNumber")
      .populate("courtStation", "name level")
      .lean();

    return res.status(201).json(populated);
  } catch (err: any) {
    const message = err.code === 11000 ? "Duplicate Cause Number" : err.message;
    return res.status(400).json({ message });
  }
};
