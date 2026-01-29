import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import Record, {
  calculateLeadTime,
  Form60Compliance,
  StatusAtGP,
} from "../models/record.model";
import Court, { ICourt } from "../models/court.model";
import { User } from "../models/User";
import sendMail from "../utils/sendMail";
import { getNextSequence } from "../utils/counter";
import { emailTemplates } from "../utils/emailTemplates";

/* =========================================================
   TYPES
========================================================= */

interface CreateRecordBody {
  courtStation: string;
  causeNo: string;
  nameOfDeceased: string;
  dateReceived: string;
  dateOfReceipt?: string;
  dateForwardedToGP?: string;
  form60Compliance?: Form60Compliance;
  rejectionReason?: string;
}

/* =========================================================
    INTERNAL HELPERS
========================================================= */

const notifyStakeholders = async (
  record: any,
  isForwarding: boolean = false,
) => {
  const [court, admins] = await Promise.all([
    Court.findById(record.courtStation).lean<ICourt>(),
    User.find({ role: "Admin", accountVerified: true }).select("email").lean(),
  ]);

  const adminEmails = admins.map((a) => a.email);
  const courtEmail = court?.primaryEmail;
  const recipients = [...adminEmails, courtEmail].filter(Boolean) as string[];

  /**
   * SAFETY: Always compute from source dates
   */
  const recTime =
    calculateLeadTime(record.dateOfReceipt, record.dateReceived) ?? 0;

  const forTime =
    calculateLeadTime(record.dateReceived, record.dateForwardedToGP) ?? 0;

  const currentLeadTime = Math.abs(isForwarding ? forTime : recTime);

  const emailData = {
    causeNo: record.causeNo,
    deceasedName: record.nameOfDeceased,
    courtName: court?.name || "Registry Station",
    reason: record.rejectionReason || "No reason provided",
    leadTime: currentLeadTime,
  };

  const jobs: Promise<any>[] = [];

  /* KPI ALERT (> 30 DAYS) */
  if (currentLeadTime > 30 && !record.kpiAlertSent) {
    const warning = emailTemplates.leadTimeWarning({
      causeNo: record.causeNo,
      leadTime: currentLeadTime,
      deceasedName: record.nameOfDeceased,
      courtName: court?.name || "Registry Station",
    });

    adminEmails.forEach((email) => {
      jobs.push(
        sendMail({ to: email, subject: warning.subject, html: warning.html }),
      );
    });

    await Record.findByIdAndUpdate(record._id, {
      $set: { kpiAlertSent: true },
    });
  }

  /* STANDARD NOTIFICATIONS */
  const template = isForwarding
    ? emailTemplates.recordForwarded(emailData)
    : record.form60Compliance === Form60Compliance.REJECTED
      ? emailTemplates.recordRejected(emailData)
      : emailTemplates.recordApproved(emailData);

  recipients.forEach((email) => {
    jobs.push(
      sendMail({ to: email, subject: template.subject, html: template.html }),
    );
  });

  await Promise.allSettled(jobs);
};

export const createRecord = async (req: Request, res: Response) => {
  const { causeNo } = req.body as CreateRecordBody; // <-- make sure causeNo is accessible
  const session = await mongoose.startSession();
  try {
    const {
      courtStation,
      nameOfDeceased,
      dateReceived,
      dateOfReceipt,
      dateForwardedToGP,
      form60Compliance,
      rejectionReason,
    } = req.body as CreateRecordBody;

    // Validate required fields
    if (!courtStation || !causeNo || !nameOfDeceased || !dateReceived) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    session.startTransaction();
    const nextNo = await getNextSequence("record");

    const [record] = await Record.create(
      [
        {
          no: nextNo,
          courtStation: new Types.ObjectId(courtStation),
          causeNo: causeNo.toUpperCase().trim(),
          nameOfDeceased,
          dateReceived: new Date(dateReceived),
          dateOfReceipt: dateOfReceipt ? new Date(dateOfReceipt) : undefined,
          dateForwardedToGP: dateForwardedToGP
            ? new Date(dateForwardedToGP)
            : undefined,
          form60Compliance: form60Compliance ?? Form60Compliance.APPROVED,
          rejectionReason,
          kpiAlertSent: false,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    notifyStakeholders(record.toObject()).catch(console.error);

    return res.status(201).json(record);
  } catch (err: any) {
    if (session.inTransaction()) await session.abortTransaction();

    // Fix: reference causeNo from above
    if (
      err.code === 11000 &&
      err.keyPattern?.courtStation &&
      err.keyPattern?.causeNo
    ) {
      return res.status(400).json({
        message: `Cause number "${causeNo}" already exists for this court.`,
      });
    }

    return res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

export const updateRecord = async (
  req: Request<{ id: string }>,
  res: Response,
) => {
  try {
    const updated = await Record.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) return res.status(404).json({ message: "Record not found" });

    const isForwarding = Object.prototype.hasOwnProperty.call(
      req.body,
      "dateForwardedToGP",
    );

    notifyStakeholders(updated.toObject(), isForwarding).catch(console.error);

    return res.status(200).json(updated);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

export const getAllRecords = async (_req: Request, res: Response) => {
  try {
    const records = await Record.find()
      .select(
        `
        no
        causeNo
        nameOfDeceased
        dateReceived
        dateOfReceipt
        dateForwardedToGP
        receivingLeadTime
        forwardingLeadTime
        form60Compliance
        statusAtGP
        courtStation
        createdAt
        `,
      )
      .populate("courtStation", "name level")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch {
    return res.status(500).json({ message: "Failed to fetch records" });
  }
};

export const getRecordById = async (
  req: Request<{ id: string }>,
  res: Response,
) => {
  try {
    const record = await Record.findById(req.params.id)
      .populate("courtStation", "name level")
      .lean();
    if (!record) return res.status(404).json({ message: "Record not found" });
    return res.status(200).json(record);
  } catch {
    return res.status(500).json({ message: "Failed to fetch record" });
  }
};

export const getRecordsByCourt = async (
  req: Request<{ courtId: string }>,
  res: Response,
) => {
  try {
    const records = await Record.find({ courtStation: req.params.courtId })
      .populate("courtStation", "name")
      .sort({ createdAt: -1 })
      .lean();
    return res.status(200).json({ success: true, records });
  } catch {
    return res.status(500).json({ message: "Failed to fetch court records" });
  }
};

/* =========================================================
    BULK & REPORTING OPERATIONS
========================================================= */

export const updateMultipleRecordsDateForwarded = async (
  req: Request<{}, {}, { ids: string[]; date: string }>,
  res: Response,
) => {
  try {
    const { ids, date } = req.body;
    if (!ids || !Array.isArray(ids))
      return res.status(400).json({ message: "Invalid 'ids' array." });

    const validIds = ids.filter((id) => id && Types.ObjectId.isValid(id));
    const newForwardedDate = new Date(date);
    const records = await Record.find({ _id: { $in: validIds } });

    const operations = records.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            dateForwardedToGP: newForwardedDate,
            // Math.abs logic is inside calculateLeadTime
            forwardingLeadTime: calculateLeadTime(
              doc.dateReceived,
              newForwardedDate,
            ),
            statusAtGP: StatusAtGP.PENDING,
          },
        },
      },
    }));

    await Record.bulkWrite(operations);

    const updatedRecords = await Record.find({ _id: { $in: validIds } });
    updatedRecords.forEach((r) =>
      notifyStakeholders(r, true).catch(console.error),
    );

    return res.status(200).json({
      success: true,
      modifiedCount: operations.length,
      records: updatedRecords,
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

/* =========================================================
    ULTRA-FAST STATISTICS (1 Query instead of 7)
========================================================= */

export const getRecordStats = async (_req: Request, res: Response) => {
  try {
    const stats = await Record.aggregate([
      {
        $facet: {
          metrics: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                approved: {
                  $sum: {
                    $cond: [{ $eq: ["$form60Compliance", "Approved"] }, 1, 0],
                  },
                },
                rejected: {
                  $sum: {
                    $cond: [{ $eq: ["$form60Compliance", "Rejected"] }, 1, 0],
                  },
                },
                pending: {
                  $sum: { $cond: [{ $eq: ["$statusAtGP", "Pending"] }, 1, 0] },
                },
                published: {
                  $sum: {
                    $cond: [{ $eq: ["$statusAtGP", "Published"] }, 1, 0],
                  },
                },
                kpiBreaches: {
                  $sum: { $cond: [{ $gt: ["$forwardingLeadTime", 30] }, 1, 0] },
                },
                avgRec: { $avg: "$receivingLeadTime" },
                avgFor: { $avg: "$forwardingLeadTime" },
              },
            },
          ],
        },
      },
    ]);

    const data = stats[0].metrics[0] || { total: 0 };

    return res.status(200).json({
      success: true,
      stats: {
        total: data.total || 0,
        compliance: {
          approved: data.approved || 0,
          rejected: data.rejected || 0,
        },
        gpStatus: {
          pending: data.pending || 0,
          published: data.published || 0,
        },
        kpiBreaches: data.kpiBreaches || 0,
        averages: {
          receivingLeadTime: Math.round(data.avgRec || 0),
          forwardingLeadTime: Math.round(data.avgFor || 0),
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ message: "Stats generation failed" });
  }
};

/* =========================================================
    OPTIMIZED FETCHING
========================================================= */

export const getRecordsForAdmin = async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "10",
      search = "",
      court,
      compliance,
      kpi,
    } = req.query as Record<string, string>;

    const limitNum = Math.min(Number(limit), 100);
    const skip = (Number(page) - 1) * limitNum;

    const query: any = {};
    if (court && Types.ObjectId.isValid(court)) query.courtStation = court;
    if (compliance) query.form60Compliance = compliance;
    if (kpi === "breached") query.forwardingLeadTime = { $gt: 30 };
    if (search) query.$text = { $search: search };

    const [records, total] = await Promise.all([
      Record.find(query)
        .select(
          `
          no
          causeNo
          nameOfDeceased
          dateReceived
          dateForwardedToGP
          forwardingLeadTime
          form60Compliance
          statusAtGP
          courtStation
          createdAt
          `,
        )
        .populate("courtStation", "name level")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Record.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      records,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch {
    return res.status(500).json({ message: "Admin fetch failure" });
  }
};

export const getAdvancedReports = async (_req: Request, res: Response) => {
  try {
    const stats = await Record.aggregate([
      {
        $facet: {
          // 1. General Totals
          generalStats: [
            {
              $group: {
                _id: null,
                totalRecords: { $sum: 1 },
                avgForwardingTime: { $avg: "$forwardingLeadTime" },
                avgReceivingTime: { $avg: "$receivingLeadTime" },
                compliantCount: {
                  $sum: {
                    $cond: [{ $eq: ["$form60Compliance", "Approved"] }, 1, 0],
                  },
                },
              },
            },
          ],
          // 2. Performance by Court (High/Low Lead Times)
          courtPerformance: [
            {
              $group: {
                _id: "$courtStation",
                avgLeadTime: { $avg: "$forwardingLeadTime" },
                recordCount: { $sum: 1 },
              },
            },
            { $sort: { avgLeadTime: 1 } }, // Best performing first
            {
              $lookup: {
                from: "courts", // assumes collection name is courts
                localField: "_id",
                foreignField: "_id",
                as: "courtDetails",
              },
            },
            { $unwind: "$courtDetails" },
          ],
        },
      },
    ]);

    return res.status(200).json({ success: true, data: stats[0] });
  } catch (err) {
    return res.status(500).json({ message: "Report generation failed" });
  }
};

export const verifyRecords = async (req: Request, res: Response) => {
  try {
    const validIds = req.body.ids.filter(Types.ObjectId.isValid);
    const result = await Record.updateMany(
      { _id: { $in: validIds } },
      { $set: { statusAtGP: StatusAtGP.PUBLISHED, datePublished: new Date() } },
    );
    return res
      .status(200)
      .json({ success: true, modifiedCount: result.modifiedCount });
  } catch {
    return res.status(500).json({ message: "Verification failed" });
  }
};

export const deleteRecord = async (
  req: Request<{ id: string }>,
  res: Response,
) => {
  try {
    const deleted = await Record.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    return res.status(200).json({ success: true });
  } catch {
    return res.status(500).json({ message: "Delete failed" });
  }
};
