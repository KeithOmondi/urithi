import * as SibApiV3Sdk from "sib-api-v3-sdk";
import { env } from "../config/env";
import Court, { ICourt } from "../models/court.model";

/* =========================================================
   INIT BREVO TRANSACTIONAL API
========================================================= */

if (!env.BREVO_API_KEY) {
  throw new Error("❌ BREVO_API_KEY is missing in your .env file");
}

if (env.BREVO_API_KEY.startsWith("xsmtp")) {
  console.warn(
    "⚠️ It looks like you are using an SMTP key for the REST API. " +
      "Please use a REST API key (starts with 'xkeysib-') for sendTransacEmail."
  );
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
  includeDefaultCC?: boolean;
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
  includeDefaultCC = true,
}: SendMailOptions) => {
  try {
    const toList = Array.isArray(to) ? to.map((email) => ({ email })) : [{ email: to }];

    const defaultCCList =
      includeDefaultCC && env.MAIL_FROM_EMAIL ? [{ email: env.MAIL_FROM_EMAIL }] : [];

    const ccListFromArgs = cc
      ? Array.isArray(cc)
        ? cc.map((email) => ({ email }))
        : [{ email: cc }]
      : [];

    const finalCcList = [...defaultCCList, ...ccListFromArgs];

    const response = await transactionalApi.sendTransacEmail({
      sender: {
        name: env.MAIL_FROM_NAME,
        email: env.MAIL_FROM_EMAIL,
      },
      to: toList,
      cc: finalCcList.length ? finalCcList : undefined,
      subject,
      htmlContent: html,
      textContent: text,
      replyTo: replyTo ? { email: replyTo } : undefined,
    });

    console.log("📧 [EMAIL SENT]", response.messageId || "ok");
    return response;
  } catch (error: any) {
    if (
      error?.response?.body?.message?.includes("Key not found") ||
      error?.response?.body?.code === "unauthorized"
    ) {
      console.error(
        "❌ BREVO API ERROR: Key invalid or wrong type. Use a REST API key (starts with xkeysib-) for sendTransacEmail."
      );
    } else {
      console.error("❌ [BREVO API ERROR]", error?.response?.body || error);
    }
    throw new Error("Email failed");
  }
};

/* =========================================================
   HELPER TO SEND EMAILS TO COURTS
========================================================= */

export const sendEmailToCourt = async (
  courtId: string,
  subject: string,
  html: string,
  text?: string
) => {
  const court: ICourt | null = await Court.findById(courtId);
  if (!court) throw new Error("Court not found");

  // TO: Primary email of the court
  const to = court.primaryEmail;

  // CC: Secondary emails + our system email
  const cc: string[] = [];
  if (court.secondaryEmails?.length) cc.push(...court.secondaryEmails);

  // MAIL_FROM_EMAIL is automatically included in sendMail by default, so no need to add manually

  return sendMail({
    to,
    cc: cc.length ? cc : undefined,
    subject,
    html,
    text,
  });
};

export default sendMail;
