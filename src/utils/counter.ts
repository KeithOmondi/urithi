import Counter from "../models/counter.model";
import mongoose from "mongoose";

export const getNextSequence = async (
  id: string,
  session?: mongoose.ClientSession
): Promise<number> => {
  const counter = await Counter.findByIdAndUpdate(
    id,
    { $inc: { seq: 1 } },
    {
      new: true,
      upsert: true,
      session,
    }
  ).lean();

  if (!counter) {
    throw new Error("Failed to generate sequence");
  }

  return counter.seq;
};
