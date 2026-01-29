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
}

const JUDICIAL_GREEN = "#1a3a32";
const REJECTION_RED = "#b91c1c";
const WARNING_AMBER = "#d97706";
const NEUTRAL_SLATE = "#334155";
const LOGO_URL =
  "https://judiciary.go.ke/wp-content/uploads/2023/05/logo1-Copy-2.png";

const containerStyle =
  "font-family: 'Times New Roman', Times, serif; max-width: 650px; margin: auto; border: 1px solid #d1d5db; border-radius: 8px; overflow: hidden; line-height: 1.6;";
const headerStyle = `background-color: ${JUDICIAL_GREEN}; padding: 25px; color: white; text-align: center; border-bottom: 3px solid #c5a059;`;

export const emailTemplates = {
  /**
   * TRIGGER: Initial Record Creation/Approval
   * MESSAGE: We have it, you'll be notified when we forward it.
   */
  recordApproved: (data: TemplateData): BaseEmail => ({
    subject: `ACKNOWLEDGMENT OF RECEIPT: Cause No. ${data.causeNo}`,
    html: `
      <div style="${containerStyle}">
        <div style="${headerStyle}">
          <img src="${LOGO_URL}" alt="Judiciary Logo" style="height: 60px; margin-bottom: 10px;" />
          <h2 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 2px;">Principal Registry</h2>
          <p style="margin: 5px 0 0 0; font-size: 11px; opacity: 0.9;">Republic of Kenya | The Judiciary</p>
        </div>
        <div style="padding: 30px; color: ${NEUTRAL_SLATE};">
          <p>This is to acknowledge that the Principal Registry has received and verified the following record from <strong>${data.courtName}</strong>:</p>
          
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; margin: 20px 0; border-radius: 6px;">
             <strong>Cause Number:</strong> ${data.causeNo}<br>
             <strong>Name of Deceased:</strong> <span style="text-transform: uppercase;">${data.deceasedName}</span>
          </div>

          <p>Please be advised that the record is now awaiting transmission to the Government Printer for gazettement. <strong>You will receive a further notification once the document has been successfully forwarded.</strong></p>
          
          <p style="margin-top: 25px; font-weight: bold; color: ${JUDICIAL_GREEN};">Regards,<br>Principal Registry Team</p>
        </div>
      </div>
    `,
  }),

  /**
   * TRIGGER: Bulk Update (Date Forwarded to GP)
   * MESSAGE: It has been sent for gazettement.
   */
  recordForwarded: (data: TemplateData): BaseEmail => ({
    subject: `NOTIFICATION OF GAZETTEMENT: Cause No. ${data.causeNo}`,
    html: `
      <div style="${containerStyle}">
        <div style="${headerStyle}">
          <img src="${LOGO_URL}" alt="Judiciary Logo" style="height: 60px; margin-bottom: 10px;" />
          <h2 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 2px;">Principal Registry</h2>
          <p style="margin: 5px 0 0 0; font-size: 11px; opacity: 0.9;">Republic of Kenya | The Judiciary</p>
        </div>
        <div style="padding: 30px; color: ${NEUTRAL_SLATE};">
          <h3 style="color: ${JUDICIAL_GREEN}; margin-top: 0;">Transmission to Government Printer</h3>
          <p>We are pleased to inform you that the following document has been forwarded to the <strong>Government Printer</strong> for official gazettement:</p>
          
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 20px; margin: 20px 0; border-radius: 6px;">
             <strong>Cause Number:</strong> ${data.causeNo}<br>
             <strong>Name of Deceased:</strong> <span style="text-transform: uppercase;">${data.deceasedName}</span>
          </div>

          <p>The status of this record has been updated to <strong>"Pending Publication"</strong>.</p>
          <p style="margin-top: 25px; font-weight: bold; color: ${JUDICIAL_GREEN};">Regards,<br>Principal Registry Team</p>
        </div>
      </div>
    `,
  }),

  recordRejected: (data: TemplateData): BaseEmail => ({
    subject: `REJECTION NOTICE: Cause No. ${data.causeNo}`,
    html: `
      <div style="${containerStyle}">
        <div style="${headerStyle} background-color: ${REJECTION_RED};">
          <img src="${LOGO_URL}" alt="Judiciary Logo" style="height: 60px; margin-bottom: 10px;" />
          <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">Compliance Rejection</h2>
        </div>
        <div style="padding: 30px; color: ${NEUTRAL_SLATE};">
          <p>The submission for <strong>${data.causeNo}</strong> has been rejected due to discrepancies in Form 60 compliance.</p>
          <div style="background-color: #fff1f2; border-left: 4px solid ${REJECTION_RED}; padding: 20px; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: ${REJECTION_RED};">${data.reason || "Refer to manual verification notes."}</p>
          </div>
          <p>Kindly rectify and resubmit.</p>
        </div>
      </div>
    `,
  }),

  leadTimeWarning: (data: TemplateData): BaseEmail => ({
    subject: `INORDINATE DELAY: Cause No. ${data.causeNo}`,
    html: `
      <div style="${containerStyle}">
        <div style="${headerStyle} background-color: ${WARNING_AMBER};">
          <img src="${LOGO_URL}" alt="Judiciary Logo" style="height: 60px; margin-bottom: 10px;" />
          <h2 style="margin: 0; font-size: 18px; text-transform: uppercase;">Service Delivery Alert</h2>
        </div>
        <div style="padding: 40px; color: ${NEUTRAL_SLATE}; text-align: justify;">
          <p>Your Honour,</p>
          <p>We note that the notices for <strong>${data.causeNo}</strong> were received <strong>${data.leadTime} days</strong> after receipt on e-Citizen. This exceeds the 14-day standard mandated by the <strong>STAJ Vision</strong>.</p>
          <p>Please ensure future compliance with Judicial Service Delivery Standards.</p>
        </div>
      </div>
    `,
  }),
};
