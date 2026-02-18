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
   CREATE REJECTION RECORD (DEV DEBUG VERSION)
   - Added logging and user-friendly error messages
===================================== */
export const createRejectionRecord = async (
  req: CustomRequest,
  res: Response,
) => {
  try {
    const { causeNo, deceasedName, rejectionReason, dateOfRejection, courtStation } = req.body;

    // 🔹 Log incoming data for debugging
    console.log("=== Incoming Rejection Submission ===");
    console.log("BODY:", req.body);
    console.log("FILE:", req.file);
    console.log("USER:", req.user);

    // Validation for all required fields including the file
    if (!causeNo || !deceasedName || !rejectionReason || !courtStation || !req.file) {
      let missingFields: string[] = [];
      if (!causeNo) missingFields.push("Cause No");
      if (!deceasedName) missingFields.push("Deceased Name");
      if (!rejectionReason) missingFields.push("Reason for Rejection");
      if (!courtStation) missingFields.push("Court Station");
      if (!req.file) missingFields.push("Supporting Document");

      return res.status(400).json({ 
        message: `Submission failed. Missing required field(s): ${missingFields.join(", ")}. Please provide all required details.` 
      });
    }

    // Create record using the data sent from the frontend form
    const createdRejection = await Rejection.create({
      causeNo: causeNo.toUpperCase().trim(),
      deceasedName: deceasedName.trim(),
      rejectionReason,
      dateReceived: dateOfRejection || new Date(),
      fileUrl: req.file.path, // Cloudinary URL from middleware
      courtStation,           // Uses the ID selected in the dropdown
      updatedBy: req.user.id,
      lastEditAction: "Initial Archive Creation",
    });

    // Populate for the immediate frontend state update
    const populated = await Rejection.findById(createdRejection._id)
      .populate("updatedBy", "firstName lastName pjNumber")
      .populate("courtStation", "name level")
      .lean();

    console.log("✅ Rejection record created successfully:", populated);

    return res.status(201).json(populated);
  } catch (err: any) {
    console.error("❌ Error creating rejection record:", err);

    // Handle Mongoose duplicate key error (code 11000) for causeNo
    const message = err.code === 11000
      ? "A record with this Cause Number already exists. Please check and try again."
      : "An unexpected error occurred while submitting the record. Please try again.";

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