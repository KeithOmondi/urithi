// src/utils/sendMail.ts
import * as SibApiV3Sdk from "sib-api-v3-sdk";
import { env } from "../config/env";

/* =========================================================
   INIT BREVO TRANSACTIONAL API
========================================================= */

// Check key type
if (!env.BREVO_API_KEY) {
  throw new Error("❌ BREVO_API_KEY is missing in your .env file");
}

// Warn if SMTP key is used by mistake
if (env.BREVO_API_KEY.startsWith("xsmtp")) {
  console.warn(
    "⚠️ It looks like you are using an SMTP key for the REST API. " +
    "Please use a REST API key (starts with 'xkeysib-') for sendTransacEmail."
  );
}

// Get the singleton API client instance
const apiClient = SibApiV3Sdk.ApiClient.instance;

// Assign REST API key
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
   SEND EMAIL FUNCTION
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
    // Validate recipients
    const toList = Array.isArray(to)
      ? to.map((email) => ({ email }))
      : [{ email: to }];

    const defaultCC = includeDefaultCC
      ? [{ email: "kd.omondi1@gmail.com" }]
      : [];

    const ccList = cc
      ? [
          ...defaultCC,
          ...(Array.isArray(cc)
            ? cc.map((email) => ({ email }))
            : [{ email: cc }]),
        ]
      : defaultCC;

    // Send email
    const response = await transactionalApi.sendTransacEmail({
      sender: {
        name: env.MAIL_FROM_NAME,
        email: env.MAIL_FROM_EMAIL,
      },
      to: toList,
      cc: ccList.length ? ccList : undefined,
      subject,
      htmlContent: html,
      textContent: text,
      replyTo: replyTo ? { email: replyTo } : undefined,
    });

    console.log("📧 [EMAIL SENT]", response.messageId || "ok");
    return response;
  } catch (error: any) {
    // Show clear error if key is wrong
    if (
      error?.response?.body?.message?.includes("Key not found") ||
      error?.response?.body?.code === "unauthorized"
    ) {
      console.error(
        "❌ BREVO API ERROR: Key invalid or wrong type. " +
          "Use a REST API key (starts with xkeysib-) for sendTransacEmail."
      );
    } else {
      console.error("❌ [BREVO API ERROR]", error?.response?.body || error);
    }
    throw new Error("Email failed");
  }
};

export default sendMail;
