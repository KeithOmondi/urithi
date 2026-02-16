import { ICourt } from "../models/court.model";
import Court from "../models/court.model";
import { User } from "../models/User";
import { emailTemplates } from "./emailTemplates";
import sendMail from "./sendMail";
import Record, {
  Form60Compliance,
  calculateLeadTime,
} from "../models/record.model";

const BATCH_SIZE = 10;

export const notifyStakeholders = async (
  record: any,
  options?: { isForwarding?: boolean; checkKpi?: boolean },
) => {
  const { isForwarding = false, checkKpi = false } = options || {};

  const [court, admins] = await Promise.all([
    Court.findById(record.courtStation).lean<ICourt>(),
    User.find({ role: { $regex: /^admin$/i } })
      .select("email")
      .lean(),
  ]);

  const recipients = Array.from(
    new Set(
      [...admins.map((a) => a.email), court?.primaryEmail]
        .filter(Boolean)
        .map((e) => e?.toLowerCase().trim()),
    ),
  ) as string[];

  if (!recipients.length) return;

  const receiptLeadTime =
    record.receivingLeadTime ??
    calculateLeadTime(record.dateOfReceipt, record.dateReceived) ??
    0;
  const emailData = {
    causeNo: record.causeNo,
    deceasedName: record.nameOfDeceased,
    courtName: court?.name || "Registry Station",
    reason: record.rejectionReason || "No reason provided",
    leadTime: receiptLeadTime,
    approvalDate: record.dateReceived || record.updatedAt,
  };

  const jobs: any[] = [];
  let kpiSent = false;

  if (checkKpi && Number(receiptLeadTime) >= 30 && !record.kpiAlertSent) {
    const warning = emailTemplates.leadTimeWarning(emailData);
    recipients.forEach((email) => jobs.push({ to: email, ...warning }));
    kpiSent = true;
  }

  const template = isForwarding
    ? emailTemplates.recordForwarded(emailData)
    : record.form60Compliance === Form60Compliance.REJECTED
      ? emailTemplates.recordRejected(emailData)
      : emailTemplates.recordApproved(emailData);

  recipients.forEach((email) => jobs.push({ to: email, ...template }));

  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map((job) => sendMail(job).catch(console.error)));
  }

  if (kpiSent)
    await Record.findByIdAndUpdate(record._id, {
      $set: { kpiAlertSent: true },
    });
};
