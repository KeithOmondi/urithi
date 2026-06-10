import mongoose, { Schema, Document, Types } from "mongoose";
import { ICourt } from "./court.model";

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
  updatedBy?: Types.ObjectId;
  lastEditAction?: string;
  createdAt: Date;
  updatedAt: Date;
}

/* ======================================================
   HELPERS
====================================================== */

export const calculateLeadTime = (
  start?: Date | string | null,
  end?: Date | string | null
): number | null => {
  if (!start || !end) return null;
  const a = new Date(start);
  const b = new Date(end);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  // Preserves sign — negative means end is before start (data anomaly)
  return Math.ceil((b.getTime() - a.getTime()) / 86400000);
};

/* ======================================================
   SCHEMA
====================================================== */

const recordSchema = new Schema<IRecord>(
  {
    no: { type: Number, required: true, unique: true },

    courtStation: {
      type: Schema.Types.ObjectId,
      ref: "Court",
      required: true,
    },

    causeNo: { type: String, required: true, trim: true, uppercase: true },

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

    rejectionReason: String,

    statusAtGP: {
      type: String,
      enum: Object.values(StatusAtGP),
      default: StatusAtGP.PENDING,
    },

    volumeNo: String,

    datePublished: { type: Date, default: null },

    kpiAlertSent: { type: Boolean, default: false },

    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },

    lastEditAction: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

/* ======================================================
   VIRTUALS
====================================================== */

// Convenience flag — avoids recomputing the threshold everywhere in the UI
recordSchema.virtual("isKpiBreached").get(function () {
  return (this.forwardingLeadTime ?? 0) > 30;
});

/* ======================================================
   INDEXES
====================================================== */

// Unique per court — same causeNo can exist across different courts
recordSchema.index({ courtStation: 1, causeNo: 1 }, { unique: true });

/* ======================================================
   HOOKS
   NOTE: pre("save") and pre("findOneAndUpdate") run for
   single-document operations only. bulkWrite and updateMany
   bypass these hooks — callers must compute lead times manually.
====================================================== */

recordSchema.pre("save", function () {
  this.receivingLeadTime = calculateLeadTime(
    this.dateOfReceipt,
    this.dateReceived
  );
  this.forwardingLeadTime = calculateLeadTime(
    this.dateReceived,
    this.dateForwardedToGP
  );
});

// Covers both findOneAndUpdate and updateOne
for (const hook of ["findOneAndUpdate", "updateOne"] as const) {
  recordSchema.pre(hook, async function () {
    const update: any = this.getUpdate();
    if (!update) return;

    const $set = update.$set || {};

    const current = await this.model
      .findOne(this.getQuery())
      .select("dateReceived dateOfReceipt dateForwardedToGP")
      .lean();

    if (!current) return;

    const recStart = $set.dateOfReceipt ?? current.dateOfReceipt;
    const recEnd = $set.dateReceived ?? current.dateReceived;
    if (recStart && recEnd) {
      $set.receivingLeadTime = calculateLeadTime(recStart, recEnd);
    }

    const fwdStart = $set.dateReceived ?? current.dateReceived;
    const fwdEnd = $set.dateForwardedToGP ?? current.dateForwardedToGP;
    if (fwdStart && fwdEnd) {
      $set.forwardingLeadTime = calculateLeadTime(fwdStart, fwdEnd);
    }

    update.$set = $set;
  });
}

/* ======================================================
   EXPORT
====================================================== */

const Record =
  mongoose.models.Record || mongoose.model<IRecord>("Record", recordSchema);

export default Record;