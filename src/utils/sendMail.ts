import * as SibApiV3Sdk from "sib-api-v3-sdk";
import { env } from "../config/env";
import Court, { ICourt } from "../models/court.model";

/* =========================================================
   INIT BREVO TRANSACTIONAL API
========================================================= */

if (!env.BREVO_API_KEY) {
  throw new Error("❌ BREVO_API_KEY is missing in your .env file");
}

const apiClient = SibApiV3Sdk.ApiClient.instance;
apiClient.authentications["api-key"].apiKey = env.BREVO_API_KEY;

const transactionalApi = new SibApiV3Sdk.TransactionalEmailsApi(apiClient);

/* =========================================================
   TYPES
========================================================= */

export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
}

/* =========================================================
   CORE SEND FUNCTION
   - Sends exactly to what is passed
   - No hidden default CCs
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

    return await transactionalApi.sendTransacEmail({
      sender: { name: env.MAIL_FROM_NAME, email: env.MAIL_FROM_EMAIL },
      to: toList,
      cc: ccList, // only CC explicitly passed emails
      subject,
      htmlContent: html,
      textContent: text,
      replyTo: replyTo ? { email: replyTo } : undefined,
    });
  } catch (err: any) {
    console.error("❌ Email failed:", err?.response?.body || err);
    throw new Error(
      "Email failed: " + (err?.response?.body?.message || err.message),
    );
  }
};

/* =========================================================
   USER EMAIL HELPER
   - For sending to a single user
   - No CC, no default addresses
========================================================= */

export const sendEmailToUser = async (
  email: string,
  subject: string,
  html: string,
  text?: string,
) => {
  return sendMail({
    to: email,
    subject,
    html,
    text,
  });
};

/* =========================================================
   COURT EMAIL HELPER
   - Sends to primary email
   - CCs secondary emails only
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

export default sendMail;
