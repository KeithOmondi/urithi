// src/utils/email.ts
import { BrevoClient } from "@getbrevo/brevo";
import { env } from "../config/env";
import Court, { ICourt } from "../models/court.model";

/* =========================================================
   INIT
========================================================= */

const brevo = new BrevoClient({
  apiKey: env.BREVO_API_KEY,
});

/* =========================================================
   TYPES
========================================================= */

interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
}

/* =========================================================
   CORE SEND FUNCTION
========================================================= */

export const sendMail = async ({
  to,
  subject,
  html,
  text,
  replyTo,
  cc,
}: SendMailOptions) => {
  try {
    const toList = Array.isArray(to)
      ? to.map((email) => ({ email }))
      : [{ email: to }];

    const ccList = cc
      ? Array.isArray(cc)
        ? cc.map((email) => ({ email }))
        : [{ email: cc }]
      : undefined;

    return await brevo.transactionalEmails.sendTransacEmail({
      sender: { name: env.SENDER_NAME, email: env.SENDER_EMAIL },
      to: toList,
      cc: ccList,
      subject,
      htmlContent: html,
      textContent: text ?? "Please enable HTML to view this message.",
      replyTo: replyTo ? { email: replyTo } : undefined,
    });
  } catch (err: any) {
    const errorMsg = err?.response?.body?.message || err.message;
    console.error(`[EMAIL ERROR] to ${to}:`, errorMsg);
    throw new Error(`Email sending failed: ${errorMsg}`);
  }
};

/* =========================================================
   USER EMAIL HELPER
========================================================= */

export const sendEmailToUser = async (
  email: string,
  subject: string,
  html: string,
  text?: string,
) => {
  return sendMail({ to: email, subject, html, text });
};

/* =========================================================
   COURT EMAIL HELPER
========================================================= */

export const sendEmailToCourt = async (
  courtId: string,
  subject: string,
  html: string,
  text?: string,
) => {
  const court: ICourt | null = await Court.findById(courtId);
  if (!court) throw new Error("Court not found");

  return sendMail({
    to: court.primaryEmail,
    cc: court.secondaryEmails?.length ? court.secondaryEmails : undefined,
    subject,
    html,
    text,
  });
};

/* =========================================================
   OTP EMAIL
========================================================= */

export const sendOtpMail = async (
  email: string,
  pjNumber: string,
  otp: string,
) => {
  return sendMail({
    to: email,
    subject: "Your Secure Portal Login Code",
    html: `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 500px; margin: 0 auto;">
        <h2 style="color: #333; text-align: center;">Secure Portal Access</h2>
        <p>A login request was initiated for PJ Number: <strong>${pjNumber}</strong>.</p>
        <p>Use the verification code below to complete your authentication. This code expires in 10 minutes:</p>
        <div style="background: #f4f6f9; padding: 15px; font-size: 28px; font-weight: bold; text-align: center; letter-spacing: 6px; color: #1a73e8; border-radius: 4px; margin: 25px 0;">
          ${otp}
        </div>
        <p style="color: #666; font-size: 12px; text-align: center;">
          If you did not make this request, you can safely ignore this email.
        </p>
      </div>
    `,
  });
};

export default sendMail;