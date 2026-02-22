import mongoose, { Schema, Document } from "mongoose";

export enum RejectionStatus {
  PENDING = "pending",
  RECTIFIED = "rectified",
}

export interface IRejection extends Document {
  causeNo: string;
  deceasedName: string;
  rejectionReason: string;
  dateReceived: Date;
  fileUrl?: string;
  courtStation: mongoose.Types.ObjectId;
  updatedBy: mongoose.Types.ObjectId;
  status: RejectionStatus;
  lastEditAction?: string;
  kpiAlertSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const rejectionSchema = new Schema<IRejection>(
  {
    causeNo: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      // Individual unique: true removed to allow same CauseNo in different courts
    },
    deceasedName: {
      type: String,
      required: true,
      trim: true,
    },
    rejectionReason: {
      type: String,
      required: true,
    },
    dateReceived: {
      type: Date,
      default: Date.now,
    },
    fileUrl: {
      type: String,
      required: false,
      default: "",
    },
    courtStation: {
      type: Schema.Types.ObjectId,
      ref: "Court",
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(RejectionStatus),
      default: RejectionStatus.PENDING,
    },
    lastEditAction: {
      type: String,
    },
    kpiAlertSent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

/**
 * COMPOUND INDEX
 * This ensures that a specific Cause Number can only exist ONCE per Court Station.
 * It solves the issue where different courts use the same numbering systems.
 */
rejectionSchema.index({ causeNo: 1, courtStation: 1 }, { unique: true });

const Rejection =
  mongoose.models.Rejection ||
  mongoose.model<IRejection>("Rejection", rejectionSchema);

export default Rejection;
