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
  cc?: string | string[]; // optional additional CC
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
  cc,
}: SendMailOptions) => {
  try {
    const recipients = Array.isArray(to)
      ? to.map((email) => ({ email }))
      : [{ email: to }];

    // Always include principalregistry@court.go.ke
    const defaultCC = [{ email: "principalregistry@court.go.ke" }];

    // Merge extra CC if provided
    const ccRecipients = cc
      ? [
          ...defaultCC,
          ...(Array.isArray(cc) ? cc.map((email) => ({ email })) : [{ email: cc }]),
        ]
      : defaultCC;

    const emailData = {
      sender: {
        name: env.MAIL_FROM_NAME!,
        email: env.MAIL_FROM_EMAIL!,
      },
      to: recipients,
      cc: ccRecipients,
      subject,
      htmlContent: html,
      textContent: text,
      replyTo: replyTo ? { email: replyTo } : undefined,
    };

    const response = await transactionalApi.sendTransacEmail(emailData as any);

    const result = response?.body || response;
    const messageId = result?.messageId || "No ID returned";

    console.log(
      `[EMAIL SENT] To: ${recipients.map(r => r.email).join(", ")} | CC: ${ccRecipients
        .map(c => c.email)
        .join(", ")} → ${messageId}`
    );

    return result;
  } catch (error: any) {
    const errorBody = error?.response?.body || error;
    console.error("[EMAIL ERROR DETAIL]", JSON.stringify(errorBody, null, 2));

    throw new Error(
      error?.response?.body?.message || error.message || "Email failed"
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
