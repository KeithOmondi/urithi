import mongoose, { Schema, Document } from "mongoose";

/* =====================================
   USER ROLES
===================================== */
export enum UserRole {
  ADMIN = "admin",
  USER = "user",
}

/* =====================================
   USER INTERFACE
===================================== */
export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email?: string;
  pjNumber: string;
  role: UserRole;
  isActive: boolean;

  // OTP Auth
  otp?: string;
  otpExpires?: Date;
}

/* =====================================
   USER SCHEMA
===================================== */
const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true,
    },

    pjNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true, // normalize for consistent lookups
    },

    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Hashed OTP (never returned)
    otp: {
      type: String,
      select: false,
    },

    otpExpires: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
  },
);

/* =====================================
   EXPORT MODEL
===================================== */
export const User =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);
