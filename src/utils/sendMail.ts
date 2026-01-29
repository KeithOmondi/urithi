import * as SibApiV3Sdk from "sib-api-v3-sdk";
import { env } from "../config/env";

/* ============================================================
   INIT CLIENT
============================================================ */

const client = SibApiV3Sdk.ApiClient.instance;

client.authentications["api-key"].apiKey = env.BREVO_API_KEY!;

const transactionalApi = new SibApiV3Sdk.TransactionalEmailsApi();
const accountApi = new SibApiV3Sdk.AccountApi();

/* ============================================================
   TYPES
============================================================ */

interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/* ============================================================
   SEND EMAIL
============================================================ */

export const sendMail = async ({
  to,
  subject,
  html,
  text,
  replyTo,
}: SendMailOptions) => {
  try {
    const recipients = Array.isArray(to)
      ? to.map((email) => ({ email }))
      : [{ email: to }];

    const emailData = {
      sender: {
        name: env.MAIL_FROM_NAME!,
        email: env.MAIL_FROM_EMAIL!,
      },
      to: recipients,
      subject,
      htmlContent: html,
      textContent: text,
      replyTo: replyTo ? { email: replyTo } : undefined,
    };

    // 1. Perform the request
    const response = await transactionalApi.sendTransacEmail(emailData as any);

    /**
     * 2. HANDLE THE RESPONSE SAFELY
     * Some versions of the SDK return the body inside 'response', 
     * others return it as 'response.body'. 
     */
    const result = response?.body || response;
    const messageId = result?.messageId || "No ID returned";

    console.log(`[EMAIL SENT] ${recipients.map(r => r.email).join(", ")} → ${messageId}`);

    return result;
  } catch (error: any) {
    // 3. IMPROVED ERROR LOGGING
    const errorBody = error?.response?.body || error;
    console.error("[EMAIL ERROR DETAIL]", JSON.stringify(errorBody, null, 2));

    throw new Error(
      error?.response?.body?.message ||
        error.message ||
        "Email failed",
    );
  }
};

/* ============================================================
   VERIFY CONNECTION
============================================================ */

export const verifyMailConnection = async () => {
  const { body } = await accountApi.getAccount();
  console.log("[BREVO CONNECTED]", body.email);
  return body;
};

export default sendMail;
