import mongoose, { Schema, Document, Model } from "mongoose";
import { ICourt } from "./court.model";

/* =====================================
    ENUMS & INTERFACE
===================================== */
export enum Form60Compliance {
  APPROVED = "Approved",
  REJECTED = "Rejected",
}

export enum StatusAtGP {
  PENDING = "Pending",
  PUBLISHED = "Published",
}

export interface IRecord extends Document {
  no: number;
  courtStation: ICourt["_id"];
  causeNo: string;
  nameOfDeceased: string;
  dateReceived: Date;
  dateOfReceipt?: Date;
  dateForwardedToGP?: Date;
  receivingLeadTime: number | null;
  forwardingLeadTime: number | null;
  form60Compliance: Form60Compliance;
  rejectionReason?: string;
  statusAtGP: StatusAtGP;
  volumeNo?: string;
  datePublished?: Date | null;
  kpiAlertSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/* =====================================
    LEAD TIME CALCULATOR
===================================== */
/**
 * Calculates days between two dates.
 * Always returns a positive number using Math.abs.
 */
export const calculateLeadTime = (
  start?: Date | string | null,
  end?: Date | string | null,
): number | null => {
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;

  const diffMs = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

/* =====================================
    SCHEMA DEFINITION
===================================== */
const recordSchema = new Schema<IRecord>(
  {
    no: { type: Number, required: true, unique: true },
    courtStation: { type: Schema.Types.ObjectId, ref: "Court", required: true },
    causeNo: { type: String, required: true, trim: true },
    nameOfDeceased: { type: String, required: true, trim: true },
    dateReceived: { type: Date, required: true },
    dateOfReceipt: Date,
    dateForwardedToGP: Date,
    receivingLeadTime: { type: Number, default: null },
    forwardingLeadTime: { type: Number, default: null },
    form60Compliance: {
      type: String,
      enum: Object.values(Form60Compliance),
      default: Form60Compliance.APPROVED,
    },
    rejectionReason: { type: String, trim: true },
    statusAtGP: {
      type: String,
      enum: Object.values(StatusAtGP),
      default: StatusAtGP.PENDING,
    },
    volumeNo: { type: String, trim: true },
    datePublished: { type: Date, default: null },
    kpiAlertSent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

/* =====================================
    PERFORMANCE INDEXES
===================================== */

// Index for Pagination & Default Sorting (Fastest fetching for Admin Dashboard)
recordSchema.index({ createdAt: -1 });

// Compound Index for Station-specific views + Duplicate Prevention
recordSchema.index({ courtStation: 1, causeNo: 1 }, { unique: true });

// Performance index for lead time filtering (KPI Dashboard)
recordSchema.index({ forwardingLeadTime: 1 });

// Text Index for Search optimization (Cause No & Deceased Name)
recordSchema.index({ causeNo: "text", nameOfDeceased: "text" });

/* =====================================
    HOOKS (Synchronous / No next())
===================================== */

/**
 * PRE-SAVE HOOK
 * Automatically triggers on .save() or .create()
 */
recordSchema.pre("save", function () {
  this.receivingLeadTime = calculateLeadTime(
    this.dateOfReceipt,
    this.dateReceived,
  );

  this.forwardingLeadTime = calculateLeadTime(
    this.dateReceived,
    this.dateForwardedToGP,
  );
});

/**
 * PRE-UPDATE HOOK
 * Triggers on findOneAndUpdate and findByIdAndUpdate
 */
recordSchema.pre("findOneAndUpdate", function () {
  const update = this.getUpdate() as any;
  const $set = update.$set || update;

  // Recalculate if dates are provided in the update payload
  if ($set.dateReceived || $set.dateOfReceipt) {
    const start = $set.dateOfReceipt || update.dateOfReceipt;
    const end = $set.dateReceived || update.dateReceived;
    if (start && end) {
      $set.receivingLeadTime = calculateLeadTime(start, end);
    }
  }

  if ($set.dateReceived || $set.dateForwardedToGP) {
    const start = $set.dateReceived || update.dateReceived;
    const end = $set.dateForwardedToGP || update.dateForwardedToGP;
    if (start && end) {
      $set.forwardingLeadTime = calculateLeadTime(start, end);
    }
  }
});

/* =====================================
    EXPORT MODEL
===================================== */
export const Record: Model<IRecord> =
  mongoose.models.Record || mongoose.model<IRecord>("Record", recordSchema);

export default Record;
