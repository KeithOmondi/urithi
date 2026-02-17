import mongoose, { Schema, Document } from "mongoose";

export enum RejectionStatus {
  PENDING = "pending",
  RECTIFIED = "rectified",
}

export interface IRejection extends Document {
  causeNo: string;
  rejectionReason: string;
  dateReceived: Date;
  fileUrl: string;
  courtStation: mongoose.Types.ObjectId;
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
      ref: "CourtStation", 
      required: false, 
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