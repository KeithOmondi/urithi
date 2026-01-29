import mongoose, { Schema, Document, Model, Types } from "mongoose";
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
  createdAt: Date;
  updatedAt: Date;
}

export const calculateLeadTime = (
  dateA?: Date | string | null,
  dateB?: Date | string | null,
): number | null => {
  if (!dateA || !dateB) return null;

  const a = new Date(dateA);
  const b = new Date(dateB);

  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;

  const diffMs = Math.abs(b.getTime() - a.getTime());

  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

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

// Indexes
recordSchema.index({ createdAt: -1 });
recordSchema.index({ courtStation: 1, causeNo: 1 }, { unique: true });
recordSchema.index({ forwardingLeadTime: 1 });
recordSchema.index({ causeNo: "text", nameOfDeceased: "text" });

/* =====================================
    HOOKS (No next() used)
===================================== */

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
  const update = this.getUpdate() as any;
  const $set = (update.$set ??= {});

  const current = await this.model.findOne(this.getQuery()).lean();
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
});

export const Record: Model<IRecord> =
  mongoose.models.Record || mongoose.model<IRecord>("Record", recordSchema);

export default Record;
