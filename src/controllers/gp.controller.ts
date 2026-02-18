import { Request, Response } from "express";
import { User } from "../models/User";
import Rejection from "../models/go.model";
import { uploadToCloudinary } from "../config/cloudinary";

interface CustomRequest extends Request {
  user?: any;
  file?: any;
}

/* =====================================
   GET GP PROFILE
===================================== */
export const getGpProfile = async (req: CustomRequest, res: Response) => {
  try {
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
   - Updated to populate updatedBy so names show in the ledger
===================================== */
export const getGpDashboard = async (req: CustomRequest, res: Response) => {
  try {
    const records = await Rejection.find({ updatedBy: req.user.id })
      .populate("courtStation", "name level") 
      .populate("updatedBy", "firstName lastName pjNumber") // Added to fix frontend "undefined"
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      gpId: req.user.id,
      records,
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};



/* =====================================
   CREATE REJECTION RECORD (PRODUCTION READY)
===================================== */
export const createRejectionRecord = async (req: CustomRequest, res: Response) => {
  console.log("=== /gp/reject hit ===");
  console.log("User Info:", req.user);
  console.log("Body:", req.body);

  if (!req.user) return res.status(401).json({ message: "No user in request" });
  if (!req.file) return res.status(400).json({ message: "File is missing" });

  try {
    // Upload buffer to Cloudinary
    const cloudResult: any = await uploadToCloudinary(req.file);
    const fileUrl = cloudResult?.secure_url;

    if (!fileUrl) {
      console.error("❌ Cloudinary returned no file URL");
      return res.status(400).json({ message: "Uploaded file URL is missing" });
    }

    // Create the rejection record
    const created = await Rejection.create({
      causeNo: req.body.causeNo.toUpperCase().trim(),
      deceasedName: req.body.deceasedName.trim(),
      rejectionReason: req.body.rejectionReason,
      dateReceived: req.body.dateOfRejection || new Date(),
      fileUrl,
      courtStation: req.body.courtStation,
      updatedBy: req.user.id,
    });

    console.log("✅ Rejection record created:", created);
    return res.status(201).json({ status: "success", data: created });
  } catch (err: any) {
    console.error("❌ Mongoose create error:", err);
    const message =
      err.code === 11000
        ? "A record with this Cause Number already exists."
        : "An unexpected error occurred while submitting the record.";
    return res.status(400).json({ message });
  }
};


/* =====================================
   FETCH ALL RECORDS (ADMIN ONLY)
===================================== */
export const getAllRecordsForAdmin = async (req: CustomRequest, res: Response) => {
  try {
    const records = await Rejection.find()
      .populate("courtStation", "name level")
      .populate("updatedBy", "firstName lastName pjNumber")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json(records);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

/* =====================================
   GET RECORD BY ID
===================================== */
export const getRecordById = async (req: CustomRequest, res: Response) => {
  try {
    const record = await Rejection.findById(req.params.id)
      .populate("courtStation", "name level")
      .populate("updatedBy", "firstName lastName pjNumber");

    if (!record) return res.status(404).json({ message: "Record not found" });
    return res.status(200).json(record);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

/* =====================================
   UPDATE REJECTION (With Tracking)
===================================== */
export const updateRejection = async (req: CustomRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body };

    // Track the user making the edit
    updates.updatedBy = req.user.id;
    updates.lastEditAction = `Modified by ${req.user.role} (${req.user.id}) at ${new Date().toISOString()}`;

    const updatedRecord = await Rejection.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    )
    .populate("updatedBy", "firstName lastName")
    .populate("courtStation", "name");

    if (!updatedRecord) return res.status(404).json({ message: "Record not found" });

    return res.status(200).json(updatedRecord);
  } catch (err: any) {
    return res.status(400).json({ message: err.message });
  }
};