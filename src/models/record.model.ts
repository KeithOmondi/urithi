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
  // --- NEW AUDIT FIELDS ---
  updatedBy?: Types.ObjectId;
  lastEditAction?: string;
  // ------------------------
  createdAt: Date;
  updatedAt: Date;
}

// Lead time calculator
export const calculateLeadTime = (
  start?: Date | string | null,
  end?: Date | string | null,
): number | null => {
  if (!start || !end) return null;
  const a = new Date(start);
  const b = new Date(end);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.ceil(Math.abs(b.getTime() - a.getTime()) / 86400000);
};

const recordSchema = new Schema<IRecord>(
  {
    no: { type: Number, required: true, unique: true },
    courtStation: { type: Schema.Types.ObjectId, ref: "Court", required: true },
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
    // AUDIT LOG FIELDS
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    lastEditAction: String,
  },
  { timestamps: true },
);

recordSchema.index({ courtStation: 1, causeNo: 1 }, { unique: true });

/* HOOKS */
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

recordSchema.pre("findOneAndUpdate", async function () {
  const update: any = this.getUpdate();
  const $set = (update.$set ??= update); // Handle cases where $set might not be explicitly used
  const current = await this.model.findOne(this.getQuery()).lean();
  if (!current) return;

  const recStart = $set.dateOfReceipt ?? current.dateOfReceipt;
  const recEnd = $set.dateReceived ?? current.dateReceived;
  if (recStart && recEnd)
    $set.receivingLeadTime = calculateLeadTime(recStart, recEnd);

  const fwdEnd = $set.dateForwardedToGP ?? current.dateForwardedToGP;
  const fwdStart = $set.dateReceived ?? current.dateReceived;
  if (fwdStart && fwdEnd)
    $set.forwardingLeadTime = calculateLeadTime(fwdStart, fwdEnd);
});

export default mongoose.models.Record ||
  mongoose.model<IRecord>("Record", recordSchema);
