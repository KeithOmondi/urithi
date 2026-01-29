import mongoose, { Schema, Document, Model } from "mongoose";

/* =====================================
   COURT LEVEL ENUM
===================================== */
export enum CourtLevel {
  HIGH_COURT = "High Court",
  LAW_COURTS = "Law Courts",
  KADHI_COURT = "Kadhi Court",
  CHILDRENS_COURT = "Children’s Court",
  SUB_REGISTRY = "Sub-Registry",
  OTHER = "Other",
}

/* =====================================
   COURT INTERFACE
===================================== */
export interface ICourt extends Document {
  name: string;
  level: CourtLevel;
  magistrate?: string;
  phone?: string;
  primaryEmail: string;
  secondaryEmails?: string[];
  code?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

/* =====================================
   COURT SCHEMA
===================================== */
const CourtSchema: Schema<ICourt> = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    level: {
      type: String,
      enum: Object.values(CourtLevel),
      default: CourtLevel.LAW_COURTS,
      trim: true,
    },
    magistrate: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      match: [/^\+?[0-9\s-]+$/, "Invalid phone number format"],
    },
    primaryEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/.+@.+\..+/, "Invalid email address"],
    },
    secondaryEmails: [
      {
        type: String,
        trim: true,
        lowercase: true,
        match: [/.+@.+\..+/, "Invalid email address"],
      },
    ],
    code: {
      type: String,
      trim: true,
      uppercase: true,
    },
    location: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster search by court name or code
CourtSchema.index({ name: 1, code: 1 });

/* =====================================
   COURT MODEL
===================================== */
export const Court: Model<ICourt> = mongoose.model<ICourt>(
  "Court",
  CourtSchema,
);

export default Court;
