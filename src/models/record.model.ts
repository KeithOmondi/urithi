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
  start?: Date | string | null,
  end?: Date | string | null,
): number | null => {
  if (!start || !end) return null;

  const startDate = new Date(start);
  const endDate = new Date(end);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;

  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Use Math.round to handle leap seconds/DST and Math.abs to kill the negative sign
  return Math.abs(Math.round(diffDays));
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
  const $set = update.$set || update;

  // We need current values from the DB to handle partial updates
  const current = await this.model.findOne(this.getQuery()).lean();
  if (!current) return;

  // Receiving Lead Time Calculation
  const startRec = $set.dateOfReceipt || current.dateOfReceipt;
  const endRec = $set.dateReceived || current.dateReceived;
  if (startRec && endRec) {
    $set.receivingLeadTime = calculateLeadTime(startRec, endRec);
  }

  // Forwarding Lead Time Calculation
  const startFwd = $set.dateReceived || current.dateReceived;
  const endFwd = $set.dateForwardedToGP || current.dateForwardedToGP;
  if (startFwd && endFwd) {
    $set.forwardingLeadTime = calculateLeadTime(startFwd, endFwd);
  }
});

export const Record: Model<IRecord> =
  mongoose.models.Record || mongoose.model<IRecord>("Record", recordSchema);

export default Record;
