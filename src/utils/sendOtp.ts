import crypto from "crypto";
import { User } from "../models/User";
import sendMail from "./sendMail";
import { emailTemplates } from "./emailTemplates";

/**
 * Generate, hash, save, and email OTP
 */
export const sendOtp = async (user: typeof User.prototype) => {
  if (!user.email) throw new Error("User has no email set.");

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash OTP
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  // Save hashed OTP and expiry (5 mins)
  user.otp = hashedOtp;
  user.otpExpires = new Date(Date.now() + 5 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  // Prepare email content
  const mailData = emailTemplates.loginOtp(otp);

  // Send email only to user (no CC)
  await sendMail({ ...mailData, to: user.email, includeDefaultCC: false });

  return otp;
};
