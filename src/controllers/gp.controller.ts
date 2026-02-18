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
/* =====================================
   CREATE REJECTION RECORD (DEBUG VERSION)
   - Logs key info for debugging in production
===================================== */
export const createRejectionRecord = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      causeNo,
      deceasedName,
      rejectionReason,
      dateOfRejection,
      courtStation,
    } = req.body;

    // 🔹 Debug Logging
    console.log("=== /reject called ===");
    console.log("User Info:", req.user);
    console.log("File Info:", req.file);
    console.log("Body Payload:", req.body);

    // 🔹 Validate required fields
    const missingFields: string[] = [];
    if (!causeNo) missingFields.push("Cause No");
    if (!deceasedName) missingFields.push("Deceased Name");
    if (!rejectionReason) missingFields.push("Reason for Rejection");
    if (!courtStation) missingFields.push("Court Station");
    if (!req.file) missingFields.push("Supporting Document");

    if (missingFields.length > 0) {
      console.warn("Missing fields:", missingFields.join(", "));
      return res.status(400).json({
        message: `Submission failed. Missing required field(s): ${missingFields.join(
          ", "
        )}. Please provide all required details.`,
      });
    }

    // 🔹 Create the record
    const createdRejection = await Rejection.create({
      causeNo: causeNo.toUpperCase().trim(),
      deceasedName: deceasedName.trim(),
      rejectionReason,
      dateReceived: dateOfRejection || new Date(),
      fileUrl: req.file!.path, // ✅ Non-null assertion
      courtStation,
      updatedBy: req.user!.id, // non-null assertion since we've validated
      lastEditAction: "Initial Archive Creation",
    });

    // 🔹 Populate references for immediate frontend use
    const populated = await Rejection.findById(createdRejection._id)
      .populate("updatedBy", "firstName lastName pjNumber")
      .populate("courtStation", "name level")
      .lean();

    console.log("✅ Rejection record successfully created:", populated);

    return res.status(201).json(populated);
  } catch (err: any) {
    console.error("❌ Error creating rejection record:", err);

    // Handle duplicate Cause No error
    const message =
      err.code === 11000
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