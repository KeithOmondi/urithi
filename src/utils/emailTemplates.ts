interface BaseEmail {
  subject: string;
  html: string;
  text?: string;
}

interface TemplateData {
  causeNo: string;
  deceasedName: string;
  courtName: string;
  reason?: string;
  leadTime?: number;
  approvalDate?: Date | string;
}

interface LoginNotificationData {
  userName: string;
  email: string;
  loginTime: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    coordinates?: string;
  };
}

const formatDate = (value?: Date | string) => {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatDateTime = (date: Date) => {
  return date.toLocaleString("en-KE", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Africa/Nairobi",
  });
};

const getDeviceInfo = (userAgent: string) => {
  const ua = userAgent.toLowerCase();
  
  // Detect device type
  let deviceType = "Unknown";
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    deviceType = "Tablet";
  } else if (/(mobile|iphone|ipod|android|blackberry|windows phone)/i.test(ua)) {
    deviceType = "Mobile";
  } else {
    deviceType = "Desktop";
  }
  
  // Detect browser
  let browser = "Unknown";
  if (ua.includes("chrome")) browser = "Chrome";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("safari")) browser = "Safari";
  else if (ua.includes("edge")) browser = "Edge";
  else if (ua.includes("opera")) browser = "Opera";
  
  // Detect OS
  let os = "Unknown";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  
  return { deviceType, browser, os };
};

const getLocationInfo = (ip: string) => {
  // This would typically call an IP geolocation API
  // For now, return a placeholder
  return {
    city: "Nairobi",
    region: "Nairobi County",
    country: "Kenya",
    coordinates: "-1.286389, 36.817223",
  };
};

const JUDICIAL_GREEN = "#1a3a32";
const REJECTION_RED = "#b91c1c";
const WARNING_AMBER = "#d97706";
const NEUTRAL_SLATE = "#334155";
const INFO_BLUE = "#2563eb";

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
  <p style="font-size:11px;color:#94a3b8;margin-top:10px;">
    If you did not perform this login, please contact support immediately.
  </p>
`;

export const emailTemplates = {
  /* ======================================================
     LOGIN NOTIFICATION with device, time, location
  ====================================================== */
  loginNotification: (data: LoginNotificationData): BaseEmail => ({
    subject: `🔐 Security Alert: New Login to Your Account - ${formatDateTime(data.loginTime)}`,
    
    html: `
      <div style="${containerStyle}">
        <div style="${headerStyle}">
          <img src="${LOGO_URL}" alt="Judiciary Logo" style="height:60px;margin-bottom:10px;" />
          <h2 style="margin:0;font-size:18px;text-transform:uppercase;letter-spacing:2px;">
            Security Alert
          </h2>
          <p style="margin:5px 0 0;font-size:11px;opacity:.9;">
            New Sign-in Detected
          </p>
        </div>

        <div style="padding:30px;color:${NEUTRAL_SLATE};">

          <p>Dear <strong>${data.userName}</strong>,</p>

          <p>We detected a new sign-in to your account. Here are the details:</p>

          <!-- Login Summary Card -->
          <div style="background:#f0f9ff;border:1px solid #bae6fd;padding:20px;margin:20px 0;border-radius:8px;">
            <h3 style="color:${INFO_BLUE};margin:0 0 15px 0;">📋 Sign-in Details</h3>
            
            <div style="margin-bottom:12px;">
              <strong>⏰ Time:</strong> ${formatDateTime(data.loginTime)}
            </div>
            
            <div style="margin-bottom:12px;">
              <strong>🌍 IP Address:</strong> ${data.ipAddress || "Unable to detect"}
            </div>
            
            ${data.location ? `
            <div style="margin-bottom:12px;">
              <strong>📍 Location:</strong> ${data.location.city || "Unknown"}, ${data.location.region || ""} ${data.location.country ? `, ${data.location.country}` : ""}
              ${data.location.coordinates ? `<br/><span style="font-size:12px;">(Approx: ${data.location.coordinates})</span>` : ""}
            </div>
            ` : ""}
          </div>

          <!-- Device Information Card -->
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:20px;margin:20px 0;border-radius:8px;">
            <h3 style="color:${NEUTRAL_SLATE};margin:0 0 15px 0;">💻 Device Information</h3>
            
            <div style="margin-bottom:12px;">
              <strong>📱 Device Type:</strong> ${data.deviceType || "Unknown"}
            </div>
            
            <div style="margin-bottom:12px;">
              <strong>🌐 Browser:</strong> ${data.browser || "Unknown"}
            </div>
            
            <div style="margin-bottom:12px;">
              <strong>⚙️ Operating System:</strong> ${data.os || "Unknown"}
            </div>
            
            ${data.userAgent ? `
            <details style="margin-top:10px;">
              <summary style="cursor:pointer;color:#64748b;font-size:12px;">Technical Details</summary>
              <p style="font-size:11px;color:#64748b;margin-top:10px;word-break:break-all;">
                ${data.userAgent}
              </p>
            </details>
            ` : ""}
          </div>

          <!-- Account Information -->
          <div style="background:#fef3c7;border:1px solid #fde68a;padding:20px;margin:20px 0;border-radius:8px;">
            <h3 style="color:#92400e;margin:0 0 15px 0;">👤 Account Information</h3>
            
            <div style="margin-bottom:8px;">
              <strong>Email:</strong> ${data.email}
            </div>
            
            <div style="margin-bottom:8px;">
              <strong>Sign-in Time (EAT):</strong> ${formatDateTime(data.loginTime)}
            </div>
          </div>

          <!-- Security Notice -->
          <div style="background:#fff1f2;border-left:4px solid ${REJECTION_RED};padding:15px;margin:20px 0;">
            <p style="margin:0;font-size:14px;color:#991b1b;">
              <strong>⚠️ Important Security Notice</strong>
            </p>
            <p style="margin:10px 0 0 0;font-size:13px;color:#7f1d1d;">
              If you recognize this activity, you can safely ignore this email.
            </p>
            <p style="margin:10px 0 0 0;font-size:13px;color:#7f1d1d;">
              If you DID NOT authorize this login, please:
              <br/>• <strong>Change your password immediately</strong>
              <br/>• Contact the IT support team
              <br/>• Review your account activity
            </p>
          </div>

          <!-- Quick Actions -->
          <div style="text-align:center;margin:25px 0;">
            <a href="#" style="display:inline-block;background-color:${JUDICIAL_GREEN};color:white;padding:10px 20px;text-decoration:none;border-radius:5px;margin:0 5px;font-size:14px;">
              Change Password
            </a>
            <a href="#" style="display:inline-block;background-color:white;color:${JUDICIAL_GREEN};padding:10px 20px;text-decoration:none;border-radius:5px;margin:0 5px;border:1px solid ${JUDICIAL_GREEN};font-size:14px;">
              Review Account
            </a>
          </div>

          ${footerHtml}
        </div>
      </div>
    `,
    
    text: `
SECURITY ALERT: New Login to Your Account

Dear ${data.userName},

We detected a new sign-in to your account.

Sign-in Details:
- Time: ${formatDateTime(data.loginTime)}
- IP Address: ${data.ipAddress || "Unable to detect"}
- Location: ${data.location?.city || "Unknown"}, ${data.location?.country || ""}
- Device: ${data.deviceType || "Unknown"}
- Browser: ${data.browser || "Unknown"}
- Operating System: ${data.os || "Unknown"}

If you recognize this activity, you can safely ignore this email.

If you DID NOT authorize this login, please:
1. Change your password immediately
2. Contact the IT support team
3. Review your account activity

${footerHtml.replace(/<[^>]*>/g, '')}
    `,
  }),

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
     RECORD FORWARDED TO GP
  ====================================================== */
  recordForwarded: (data: TemplateData): BaseEmail => ({
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
     LEAD TIME WARNING
  ====================================================== */
  leadTimeWarning: (data: TemplateData): BaseEmail => ({
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
};