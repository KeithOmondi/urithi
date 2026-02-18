import { Request, Response } from "express";
import { User } from "../models/User";
import Rejection from "../models/go.model";
import { uploadToCloudinary } from "../config/cloudinary";
import { v2 as cloudinary } from "cloudinary";
import axios from "axios"

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
===================================== */
export const getGpDashboard = async (req: CustomRequest, res: Response) => {
  try {
    const records = await Rejection.find({ updatedBy: req.user.id })
      .populate("courtStation", "name level")
      .populate("updatedBy", "firstName lastName pjNumber")
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
   CREATE REJECTION RECORD
===================================== */
export const createRejectionRecord = async (req: CustomRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    if (!req.file) return res.status(400).json({ message: "File is missing" });

    const { causeNo, deceasedName, rejectionReason, dateOfRejection, courtStation } = req.body;
    if (!causeNo || !deceasedName || !rejectionReason || !courtStation) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    const cloudResult: any = await uploadToCloudinary(req.file);
    if (!cloudResult?.secure_url) {
      throw new Error("Cloudinary upload failed");
    }

    const created = await Rejection.create({
      causeNo: causeNo.toUpperCase().trim(),
      deceasedName: deceasedName.trim(),
      rejectionReason,
      dateReceived: dateOfRejection || new Date(),
      fileUrl: cloudResult.secure_url,
      courtStation,
      updatedBy: req.user.id,
    });

    return res.status(201).json({
      status: "success",
      data: created.toObject(),
    });
  } catch (err: any) {
    return res.status(500).json({
      message:
        err.code === 11000
          ? "A record with this Cause Number already exists."
          : "Server failed while creating rejection record.",
    });
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

/* =====================================
   PROXY FILE PREVIEW
   Bypasses Cloudinary CORS issues
===================================== */
export const proxyFilePreview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = await Rejection.findById(id);
    if (!record || !record.fileUrl)
      return res.status(404).json({ error: "File not found" });

    // Extract public ID from URL
    const urlParts = record.fileUrl.split('/');
    const uploadIndex = urlParts.indexOf('upload');
    const publicIdWithExt = urlParts.slice(uploadIndex + 2).join('/');

    const isPdf = publicIdWithExt.endsWith(".pdf");
    const resourceType = isPdf ? "raw" : "image";

    // ✅ Return signed URL directly
    const signedUrl = cloudinary.url(publicIdWithExt, {
      resource_type: resourceType,
      sign_url: true,
      secure: true,
    });

    console.log("🚀 Signed Cloudinary URL for preview:", signedUrl);

    // Just return the signed URL
    return res.json({ url: signedUrl, type: isPdf ? "pdf" : "image" });
  } catch (err: any) {
    console.error("❌ Proxy preview error:", err.message);
    res.status(500).json({ error: "Failed to generate preview" });
  }
};
