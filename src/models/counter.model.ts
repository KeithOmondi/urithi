import mongoose, { Schema, Document, Model } from "mongoose";

/* =====================================
   COUNTER INTERFACE
===================================== */
export interface ICounter extends Document<string> {
  _id: string; // string ID instead of ObjectId
  seq: number;
}

/* =====================================
   COUNTER SCHEMA
===================================== */
const counterSchema: Schema<ICounter> = new Schema(
  {
    _id: { type: String, required: true }, // e.g., "record"
    seq: { type: Number, default: 0 },
  },
  {
    versionKey: false, // removes __v
  }
);

/* =====================================
   COUNTER MODEL
===================================== */
export const Counter: Model<ICounter> = mongoose.model<ICounter>("Counter", counterSchema);

export default Counter;
