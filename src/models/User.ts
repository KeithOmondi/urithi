import mongoose, { Schema, Document } from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/* =====================================
   USER ROLES
===================================== */
export enum UserRole {
  ADMIN = "admin",
  USER = "user",
  GP = "gp",
}

/* =====================================
   USER INTERFACE
===================================== */
export interface IUser extends Document {
  firstName: string;
  lastName: string;
  email: string;
  pjNumber: string;
  role: UserRole;
  isActive: boolean;
  
  // Password Authentication
  password: string;
  passwordConfirm?: string;
  passwordChangedAt?: Date;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  
  // OTP Auth (kept for backward compatibility, optional)
  otp?: string;
  otpExpires?: Date;
  
  // Methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  createPasswordResetToken(): string;
  changedPasswordAfter(JWTTimestamp: number): boolean;
}

/* =====================================
   USER SCHEMA
===================================== */
const userSchema = new Schema<IUser>(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },

    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },

    pjNumber: {
      type: String,
      required: [true, "PJ number is required"],
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
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

    // Password Authentication
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },

    passwordChangedAt: {
      type: Date,
      select: false,
    },

    passwordResetToken: {
      type: String,
      select: false,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
    },

    // OTP Auth (kept for backward compatibility)
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
    toJSON: { 
      transform: (_doc, ret) => {
        delete (ret as any).password;
        delete (ret as any).passwordChangedAt;
        delete (ret as any).passwordResetToken;
        delete (ret as any).passwordResetExpires;
        delete (ret as any).otp;
        delete (ret as any).otpExpires;
        delete (ret as any).__v;
        return ret;
      }
    },
    toObject: {
      transform: (_doc, ret) => {
        delete (ret as any).password;
        delete (ret as any).passwordChangedAt;
        delete (ret as any).passwordResetToken;
        delete (ret as any).passwordResetExpires;
        delete (ret as any).otp;
        delete (ret as any).otpExpires;
        delete (ret as any).__v;
        return ret;
      }
    }
  }
);

/* =====================================
   PRE-SAVE HOOKS
===================================== */
// Hash password before saving
userSchema.pre("save", async function() {
  // Only hash if password is modified
  if (!this.isModified("password")) return;
  
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  
  // Set password changed timestamp (not for new users)
  if (!this.isNew) {
    this.passwordChangedAt = new Date();
  }
  
  // Clear passwordConfirm field
  this.passwordConfirm = undefined;
});

// Set email to lowercase
userSchema.pre("save", function() {
  if (this.email) {
    this.email = this.email.toLowerCase();
  }
});

/* =====================================
   VIRTUAL FIELDS
===================================== */
// Virtual for full name
userSchema.virtual("fullName").get(function() {
  return `${this.firstName} ${this.lastName}`;
});

/* =====================================
   INSTANCE METHODS
===================================== */
// Compare candidate password with stored hash
userSchema.methods.comparePassword = async function(
  candidatePassword: string
): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

// Create password reset token
userSchema.methods.createPasswordResetToken = function(): string {
  const resetToken = crypto.randomBytes(32).toString("hex");
  
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
    
  this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  
  return resetToken;
};

// Check if password was changed after JWT was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp: number): boolean {
  if (this.passwordChangedAt) {
    const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

/* =====================================
   STATIC METHODS
===================================== */
// Find user by email with password field
userSchema.statics.findByEmail = function(email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

// Find user by email with password field (for authentication)
userSchema.statics.findByEmailWithPassword = function(email: string) {
  return this.findOne({ email: email.toLowerCase() }).select("+password");
};

// Find active users
userSchema.statics.findActiveUsers = function() {
  return this.find({ isActive: true });
};

/* =====================================
   INDEXES
===================================== */
userSchema.index({ email: 1 });
userSchema.index({ pjNumber: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

/* =====================================
   EXPORT MODEL
===================================== */
export const User =
  mongoose.models.User || mongoose.model<IUser>("User", userSchema);