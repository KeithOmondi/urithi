import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICase {
  courtStation?: Types.ObjectId;
  nameOfDeceased: string;
  causeNo: string;
  status: string;
  dateForwardedToGP?: Date;
  leadTimeDays?: number;
}

export interface IGazette extends Document {
  volumeNo: string;
  datePublished: Date;
  fileName: string;
  cases: ICase[];
  publishedCount: number;
  totalRecords: number;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const caseSchema = new Schema<ICase>({
  courtStation: { type: Schema.Types.ObjectId, ref: "Court" },
  nameOfDeceased: { type: String },
  causeNo: { type: String },
  status: { type: String, default: "Pending" },
  dateForwardedToGP: { type: Date },
  leadTimeDays: { type: Number },
});

const gazetteSchema = new Schema<IGazette>(
  {
    volumeNo: { type: String, required: true },
    datePublished: { type: Date, required: true },
    fileName: { type: String, required: true },
    cases: [caseSchema],
    publishedCount: { type: Number, default: 0 },
    totalRecords: { type: Number, default: 0 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

export default mongoose.model<IGazette>("Gazette", gazetteSchema);
