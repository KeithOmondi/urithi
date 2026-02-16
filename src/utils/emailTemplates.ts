interface BaseEmail {
  subject: string;
  html: string;
}

interface TemplateData {
  causeNo: string;
  deceasedName: string;
  courtName: string;
  reason?: string;
  leadTime?: number;
  approvalDate?: Date | string;
}

const formatDate = (value?: Date | string) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const JUDICIAL_GREEN = "#1a3a32";
const REJECTION_RED = "#b91c1c";
const WARNING_AMBER = "#d97706";
const NEUTRAL_SLATE = "#334155";

const LOGO_URL =
  "https://judiciary.go.ke/wp-content/uploads/2023/05/logo1-Copy-2.png";

const containerStyle =
  "font-family:'Times New Roman',Times,serif;max-width:650px;margin:auto;border:1px solid #d1d5db;border-radius:8px;overflow:hidden;line-height:1.6;";

const headerStyle = `background-color:${JUDICIAL_GREEN};padding:25px;color:white;text-align:center;border-bottom:3px solid #c5a059;`;

const footerHtml = `
  <p style="margin-top:25px;font-weight:bold;color:${JUDICIAL_GREEN};">
    Regards,<br/>Principal Registry Team
  </p>
  <p style="font-size:12px;color:#64748b;">
    This is an automated email. Do not reply.
  </p>
`;

export const emailTemplates = {
   /* ======================================================

     RECORD APPROVED / RECEIVED

  ====================================================== */

  recordApproved: (data: TemplateData): BaseEmail => ({

    subject: `ACKNOWLEDGMENT OF RECEIPT: Cause No. ${data.causeNo}`,

    html: `

      <div style="${containerStyle}">

        <div style="${headerStyle}">

          <img src="${LOGO_URL}" alt="Judiciary Logo" style="height:60px;margin-bottom:10px;" />

          <h2 style="margin:0;font-size:18px;text-transform:uppercase;letter-spacing:2px;">

            Principal Registry

          </h2>

          <p style="margin:5px 0 0;font-size:11px;opacity:.9;">

            Republic of Kenya | The Judiciary

          </p>

        </div>



        <div style="padding:30px;color:${NEUTRAL_SLATE};">



          <p>

            This is to acknowledge that the Principal Registry has received and

            verified the following record from <strong>${data.courtName}</strong>:

          </p>



          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px;margin:20px 0;border-radius:6px;">

            <strong>Cause Number:</strong> ${data.causeNo}<br/>

            <strong>Name of Deceased:</strong>

            <span style="text-transform:uppercase;">${data.deceasedName}</span><br/>

            <strong>Date Approved:</strong> ${formatDate(data.approvalDate)}

          </div>



          <p>

            The record is now awaiting transmission to the Government Printer

            for gazettement. You will receive a further notification once the

            document has been forwarded.

          </p>



          ${footerHtml}

        </div>

      </div>

    `,

  }),



  /* ======================================================
    RECORD FORWARDED TO GP (Updated)
====================================================== */
recordForwarded: (data: TemplateData): BaseEmail => ({
  // Subject now picks the court station before the cause number
  subject: `${data.courtName} | Cause No. ${data.causeNo}: TRANSMISSION TO GOVERNMENT PRINTER`,
  html: `
    <div style="${containerStyle}">
      <div style="${headerStyle}">
        <img src="${LOGO_URL}" alt="Judiciary Logo" style="height:60px;margin-bottom:10px;" />
        <h2 style="margin:0;font-size:18px;text-transform:uppercase;letter-spacing:2px;">
          TRANSMISSION TO GOVERNMENT PRINTER
        </h2>
        <p style="margin:5px 0 0;font-size:11px;opacity:.9;">
          Republic of Kenya | The Judiciary
        </p>
      </div>

      <div style="padding:30px;color:${NEUTRAL_SLATE};">

        <h3 style="color:${JUDICIAL_GREEN};margin-top:0;">
          Official Forwarding Notification
        </h3>

        <p>
          We are pleased to inform you that the following document from <strong>${data.courtName}</strong> 
          has been forwarded to the <strong>Government Printer</strong> for official gazettement:
        </p>

        <div style="background:#f0fdf4;border:1px solid #bbf7d0;padding:20px;margin:20px 0;border-radius:6px;">
          <strong>Court Station:</strong> ${data.courtName}<br/>
          <strong>Cause Number:</strong> ${data.causeNo}<br/>
          <strong>Name of Deceased:</strong>
          <span style="text-transform:uppercase;">${data.deceasedName}</span><br/>
          <strong>Date Forwarded:</strong> ${formatDate(data.approvalDate)}
        </div>

        <p>
          The status of this record has been updated to 
          <strong>"Pending Publication"</strong>.
        </p>

        ${footerHtml}
      </div>
    </div>
  `,
}),

  /* ======================================================
   RECORD REJECTED
====================================================== */
  recordRejected: (data: TemplateData): BaseEmail => ({
    subject: `REJECTION NOTICE: Cause No. ${data.causeNo}`,
    html: `
    <div style="${containerStyle}">
      <div style="${headerStyle};background-color:${REJECTION_RED};">
        <img src="${LOGO_URL}" alt="Judiciary Logo" style="height:60px;margin-bottom:10px;" />
        <h2 style="margin:0;font-size:18px;text-transform:uppercase;">
          Compliance Rejection
        </h2>
      </div>

      <div style="padding:30px;color:${NEUTRAL_SLATE};">

        <p>
          The submission for <strong>${data.causeNo}</strong> 
          (<strong>${data.deceasedName}</strong>) has been rejected
          due to discrepancies in Form 60 compliance.
        </p>

        <p>
          <strong>Date of Rejection:</strong>
          ${formatDate(data.approvalDate)}
        </p>

        <div style="background:#fff1f2;border-left:4px solid ${REJECTION_RED};padding:20px;margin:20px 0;">
          <p style="margin:0;font-weight:bold;color:${REJECTION_RED};">
            ${data.reason || "Refer to manual verification notes."}
          </p>
        </div>

        <p>Kindly rectify and resubmit.</p>

        ${footerHtml}
      </div>
    </div>
  `,
  }),


 /* ======================================================
    LEAD TIME WARNING (Updated)
====================================================== */
leadTimeWarning: (data: TemplateData): BaseEmail => ({
  // Updated subject to focus on the specific Court Station
  subject: `INORDINATE DELAY: ${data.courtName} | Cause No. ${data.causeNo}`,
  html: `
    <div style="${containerStyle}">
      <div style="${headerStyle};background-color:#013220;color:#ffffff;">
        <img src="${LOGO_URL}" alt="Judiciary Logo" style="height:60px;margin-bottom:10px;" />
        <h2 style="margin:0;font-size:18px;text-transform:uppercase;color:#ffffff;">
          Service Delivery Alert
        </h2>
      </div>

      <div style="padding:40px;color:${NEUTRAL_SLATE};text-align:justify;">

        <p>Your Honour,</p>

        <p>
          <strong>Station:</strong> ${data.courtName}<br/>
          <strong>Date Observed:</strong> ${formatDate(data.approvalDate)}
        </p>

        <div style="background:#fffcf0; border-left:4px solid ${WARNING_AMBER}; padding:15px; margin:20px 0;">
          <p style="margin:0;">
            We note that the notices for <strong>${data.causeNo}</strong> 
            (Deceased: ${data.deceasedName}) were received 
            <strong>${data.leadTime} days</strong> after receipt on e-Citizen.
          </p>
        </div>

        <p>
          This timeline exceeds the <strong>14-day standard</strong> mandated by the 
          <strong>STAJ Vision</strong>.
        </p>

        <p>
          Please ensure future compliance with Judicial Service Delivery 
          Standards at <strong>${data.courtName}</strong>.
        </p>

        ${footerHtml}
      </div>
    </div>
  `,
}),
  /* ======================================================
     LOGIN OTP
  ====================================================== */
  loginOtp: (otp: string): BaseEmail => ({
    subject: "Login Verification Code",
    html: `
      <div style="${containerStyle}">
        <div style="${headerStyle}">
          <img src="${LOGO_URL}" alt="Judiciary Logo" style="height:60px;margin-bottom:10px;" />
          <h2 style="margin:0;font-size:18px;text-transform:uppercase;letter-spacing:2px;">
            Secure Login
          </h2>
          <p style="margin:5px 0 0;font-size:11px;opacity:.9;">
            Republic of Kenya | The Judiciary
          </p>
        </div>

        <div style="padding:30px;color:${NEUTRAL_SLATE};">

          <p>Please use the One-Time Password (OTP) below to complete your login:</p>

          <div style="
            background:#f8fafc;
            border:1px solid #e2e8f0;
            padding:20px;
            text-align:center;
            margin:25px 0;
            border-radius:6px;
            font-size:32px;
            letter-spacing:6px;
            font-weight:bold;
            color:${JUDICIAL_GREEN};
          ">
            ${otp}
          </div>

          <p>This code expires in <strong>5 minutes</strong>.</p>

          <p style="font-size:13px;color:#64748b;">
            If you did not attempt to log in, kindly ignore this email.
          </p>

          ${footerHtml}
        </div>
      </div>
    `,
  }),
};
