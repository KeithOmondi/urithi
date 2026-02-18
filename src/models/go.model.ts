import mongoose, { Schema, Document } from "mongoose";

export enum RejectionStatus {
  PENDING = "pending",
  RECTIFIED = "rectified",
}

export interface IRejection extends Document {
  causeNo: string;
  deceasedName: string; // Added field
  rejectionReason: string;
  dateReceived: Date;
  fileUrl: string;
  courtStation: mongoose.Types.ObjectId; // References Court model
  updatedBy: mongoose.Types.ObjectId;
  status: RejectionStatus;
  lastEditAction: string;
  kpiAlertSent: boolean;
}

const rejectionSchema = new Schema<IRejection>(
  {
    causeNo: { 
      type: String, 
      required: true, 
      unique: true, 
      uppercase: true, 
      trim: true 
    },
    deceasedName: { 
      type: String, 
      required: true, 
      trim: true 
    },
    rejectionReason: { 
      type: String, 
      required: true 
    },
    dateReceived: { 
      type: Date, 
      default: Date.now 
    },
    fileUrl: { 
      type: String, 
      required: true 
    },
    courtStation: { 
      type: Schema.Types.ObjectId, 
      ref: "Court", // Ensure this matches your Court model name
      required: true, 
    },
    updatedBy: { 
      type: Schema.Types.ObjectId, 
      ref: "User", 
      required: true 
    },
    status: { 
      type: String, 
      enum: Object.values(RejectionStatus), 
      default: RejectionStatus.PENDING 
    },
    lastEditAction: { 
      type: String 
    },
    kpiAlertSent: { 
      type: Boolean, 
      default: false 
    },
  },
  { timestamps: true }
);

const Rejection = mongoose.model<IRejection>("Rejection", rejectionSchema);
export default Rejection;