import crypto from "crypto";
import { User } from "../models/User";
import { sendEmailToUser } from "./sendMail";
import { emailTemplates } from "./emailTemplates";

/**
 * Generate, hash, save, and email OTP to a user
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

  // Send OTP only to this user (no CC)
  await sendEmailToUser(
    user.email,
    mailData.subject,
    mailData.html,
    mailData.text,
  );

  return otp;
};
