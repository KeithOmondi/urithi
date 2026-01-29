import mongoose, { Schema, Document, Types } from "mongoose";

// Interface for the ScanLog Document
export interface IScanLog extends Document {
  uploadedBy: Types.ObjectId;
  fileName: string;
  totalRecords: number;
  publishedCount: number;
  remarks?: string;
  dateScanned: Date;
  createdAt: Date;
  updatedAt: Date;
}

const scanLogSchema = new Schema<IScanLog>(
  {
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    totalRecords: {
      type: Number,
      required: true,
    },
    publishedCount: {
      type: Number,
      required: true,
    },
    remarks: {
      type: String,
      default: "",
      trim: true,
    },
    dateScanned: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Check if the model exists before exporting to prevent compilation re-run errors
const ScanLog = mongoose.models.ScanLog || mongoose.model<IScanLog>("ScanLog", scanLogSchema);

export default ScanLog;