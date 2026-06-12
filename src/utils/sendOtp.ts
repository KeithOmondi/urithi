import crypto from "crypto";
import { User, IUser } from "../models/User";
import { sendEmailToUser } from "./sendMail";
import { emailTemplates } from "./emailTemplates";

/**
 * Generate password reset token and send email
 */
export const sendPasswordResetToken = async (user: IUser): Promise<string> => {
  if (!user.email) throw new Error("User has no email set.");

  // Generate reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  
  // Hash and save token
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // Save hashed token and expiry (10 minutes)
  user.passwordResetToken = hashedToken;
  user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  // Prepare email content
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
  
  const mailData = {
    subject: "Password Reset Request",
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Reset Your Password</h2>
        <p>You requested to reset your password for account: <strong>${user.email}</strong></p>
        <p>Click the button below to reset your password. This link expires in 10 minutes.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #1a3a32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p>Or copy this link: ${resetUrl}</p>
        <p style="color: #666; font-size: 12px; text-align: center;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
    text: `Reset your password for ${user.email}. Copy this link: ${resetUrl}`,
  };

  // Send email
  await sendEmailToUser(
    user.email,
    mailData.subject,
    mailData.html,
    mailData.text,
  );

  return resetToken;
};

/**
 * Verify password reset token
 */
export const verifyPasswordResetToken = async (
  token: string
): Promise<IUser | null> => {
  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: new Date() },
  });

  return user;
};

/**
 * Clear password reset token after successful reset
 */
export const clearPasswordResetToken = async (user: IUser): Promise<void> => {
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save({ validateBeforeSave: false });
};