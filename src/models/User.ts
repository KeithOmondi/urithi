import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";

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
  password: string;
  role: UserRole;
  isActive: boolean;
  passwordChangedAt?: Date;

  comparePassword(candidatePassword: string): Promise<boolean>;
}

/* =====================================
   USER SCHEMA
===================================== */
const userSchema = new Schema<IUser>(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },

    email: {
      type: String,
      lowercase: true,
      trim: true,
      unique: true,
      sparse: true, // allows multiple null values
    },

    pjNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    password: { type: String, required: true, select: false },

    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },

    isActive: { type: Boolean, default: true },

    passwordChangedAt: { type: Date },
  },
  { timestamps: true },
);

/* =====================================
   PASSWORD HASHING
===================================== */
userSchema.pre("save", async function (this: IUser) {
  // Only hash password if it was modified
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 12);
  this.passwordChangedAt = new Date();
});

/* =====================================
   COMPARE PASSWORD METHOD
===================================== */
userSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

/* =====================================
   EXPORT MODEL
===================================== */
export const User =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);
