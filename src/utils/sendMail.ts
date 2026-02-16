import * as SibApiV3Sdk from "sib-api-v3-sdk";
import { env } from "../config/env";

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
    // 1. Prepare "To" list
    const toList = Array.isArray(to)
      ? to.map((email) => ({ email }))
      : [{ email: to }];

    // 2. Prepare Default CC from ENV
    const defaultCCList = (includeDefaultCC && env.DEFAULT_CC_EMAIL)
      ? [{ email: env.DEFAULT_CC_EMAIL }]
      : [];

    // 3. Merge with optional CCs passed to the function
    let finalCcList = [...defaultCCList];
    
    if (cc) {
      const additionalCc = Array.isArray(cc)
        ? cc.map((email) => ({ email }))
        : [{ email: cc }];
      finalCcList = [...finalCcList, ...additionalCc];
    }

    // 4. Send email
    const response = await transactionalApi.sendTransacEmail({
      sender: {
        name: env.MAIL_FROM_NAME,
        email: env.MAIL_FROM_EMAIL,
      },
      to: toList,
      cc: finalCcList.length > 0 ? finalCcList : undefined,
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