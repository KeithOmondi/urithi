import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import Record, {
  calculateLeadTime,
  Form60Compliance,
  StatusAtGP,
} from "../models/record.model";
import Court, { ICourt } from "../models/court.model";
import { sendEmailToCourt } from "../utils/sendMail";
import { getNextSequence } from "../utils/counter";
import { emailTemplates } from "../utils/emailTemplates";

const BATCH_SIZE = 10;

const UPDATABLE_FIELDS = [
  "causeNo",
  "nameOfDeceased",
  "dateOfReceipt",
  "dateReceived",
  "dateForwardedToGP",
  "form60Compliance",
  "rejectionReason",
  "statusAtGP",
] as const;
type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

interface NotifyOptions {
  isForwarding?: boolean;
  checkKpi?: boolean;
}

/* =========================================================
   STAKEHOLDER NOTIFICATION
========================================================= */
export const notifyStakeholders = async (
  record: any,
  options: NotifyOptions = {}
) => {
  const { isForwarding = false, checkKpi = false } = options;

  try {
    const court = await Court.findById(record.courtStation).lean<ICourt>();
    if (!court) return;

    const receiptLeadTime =
      record.receivingLeadTime ??
      calculateLeadTime(record.dateOfReceipt, record.dateReceived) ??
      0;

    const emailData = {
      causeNo: record.causeNo,
      deceasedName: record.nameOfDeceased,
      courtName: court.name,
      reason: record.rejectionReason || "No reason provided",
      leadTime: receiptLeadTime,
      approvalDate: record.dateReceived || record.updatedAt,
    };

    const jobs: { subject: string; html: string; text?: string }[] = [];
    let kpiTriggered = false;

    if (checkKpi && receiptLeadTime >= 30 && !record.kpiAlertSent) {
      jobs.push(emailTemplates.leadTimeWarning(emailData));
      kpiTriggered = true;
    }

    if (isForwarding) {
      jobs.push(emailTemplates.recordForwarded(emailData));
    } else if (record.form60Compliance === Form60Compliance.REJECTED) {
      jobs.push(emailTemplates.recordRejected(emailData));
    } else {
      jobs.push(emailTemplates.recordApproved(emailData));
    }

    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
      const batch = jobs.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map((job) =>
          sendEmailToCourt(court._id.toString(), job.subject, job.html, job.text)
        )
      );
    }

    if (kpiTriggered) {
      await Record.findByIdAndUpdate(record._id, {
        $set: { kpiAlertSent: true },
      });
    }
  } catch (error) {
    console.error(`Notification error for record ${record._id}:`, error);
  }
};

/* =========================================================
   CREATE RECORD
========================================================= */
export const createRecord = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // getNextSequence runs outside the session intentionally —
    // its counter increment is NOT rolled back on abort.
    // The duplicate check below and the 11000 catch handle the gap.
    let nextNo = await getNextSequence("record");

    const exists = await Record.findOne({ no: nextNo }).session(session);
    if (exists) {
      const maxRecord = await Record.findOne()
        .sort({ no: -1 })
        .session(session);
      nextNo = maxRecord ? maxRecord.no + 1 : 1;
    }

    const [record] = await Record.create(
      [
        {
          ...req.body,
          no: nextNo,
          causeNo: req.body.causeNo.toUpperCase().trim(),
          kpiAlertSent: false,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    notifyStakeholders(record.toObject(), { checkKpi: true });
    return res.status(201).json(record);
  } catch (err: any) {
    await session.abortTransaction();
    if (err.code === 11000) {
      return res.status(409).json({
        message: "Duplicate record number detected. Please try saving again.",
      });
    }
    return res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

/* =========================================================
   UPDATE RECORD
========================================================= */
export const updateRecord = async (
  req: Request<{ id: string }> & { user?: any },
  res: Response
) => {
  try {
    const record = await Record.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    // ✅ whitelist — prevents overwriting no, kpiAlertSent, createdAt, etc.
    const updates = (Object.keys(req.body) as UpdatableField[]).filter((k) =>
      UPDATABLE_FIELDS.includes(k)
    );
    if (!updates.length) {
      return res.status(400).json({ message: "No updatable fields provided" });
    }

    const safeBody = Object.fromEntries(updates.map((k) => [k, req.body[k]]));
    Object.assign(record, safeBody);
    record.updatedBy = req.user?.id;
    record.lastEditAction = `Updated fields: ${updates.join(", ")}`;

    await record.save();

    const updatedDoc = await Record.findById(record._id)
      .populate("courtStation", "name level")
      .lean();

    notifyStakeholders(updatedDoc, {
      isForwarding: "dateForwardedToGP" in req.body,
      checkKpi: false,
    });

    return res.status(200).json(updatedDoc);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

/* =========================================================
   GET RECORD BY ID
========================================================= */
export const getRecordById = async (
  req: Request<{ id: string }>,
  res: Response
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

/* =========================================================
   DELETE RECORD
========================================================= */
export const deleteRecord = async (
  req: Request<{ id: string }>,
  res: Response
) => {
  try {
    const deleted = await Record.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Not found" });
    return res.status(200).json({ success: true });
  } catch {
    return res.status(500).json({ message: "Delete failed" });
  }
};

/* =========================================================
   BULK UPDATE: DATE FORWARDED TO GP
========================================================= */
export const updateMultipleRecordsDateForwarded = async (
  req: any,
  res: Response
) => {
  try {
    const { ids, date } = req.body;

    // ✅ validate both inputs before touching the DB
    if (!Array.isArray(ids) || !ids.length) {
      return res
        .status(400)
        .json({ message: "ids must be a non-empty array" });
    }
    const newForwardedDate = new Date(date);
    if (isNaN(newForwardedDate.getTime())) {
      return res.status(400).json({ message: "Invalid date value" });
    }

    const validIds = ids.filter((id: string) => Types.ObjectId.isValid(id));
    if (!validIds.length) {
      return res.status(400).json({ message: "No valid record IDs provided" });
    }

    const records = await Record.find({ _id: { $in: validIds } });

    const operations = records.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            dateForwardedToGP: newForwardedDate,
            forwardingLeadTime: calculateLeadTime(
              doc.dateReceived,
              newForwardedDate
            ),
            statusAtGP: StatusAtGP.PENDING,
            updatedBy: req.user?.id,
            lastEditAction: "Batch Update: Forwarded to GP",
          },
        },
      },
    }));

    await Record.bulkWrite(operations);

    const updatedRecords = await Record.find({ _id: { $in: validIds } })
      .populate("courtStation", "name level")
      .lean();

    updatedRecords.forEach((r) => notifyStakeholders(r, { isForwarding: true }));

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
   ADMIN FETCH / FILTER
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
    if (search) {
      // ✅ guard against missing text index producing a hard 500
      if (search.trim().length < 2) {
        return res.status(400).json({ message: "Search term too short" });
      }
      query.$text = { $search: search.trim() };
    }

    const [records, total] = await Promise.all([
      Record.find(query)
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

/* =========================================================
   STATS & ANALYTICS
========================================================= */
export const getRecordStats = async (_req: Request, res: Response) => {
  try {
    const [stats] = await Record.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ["$form60Compliance", "Approved"] }, 1, 0] },
          },
          rejected: {
            $sum: { $cond: [{ $eq: ["$form60Compliance", "Rejected"] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ["$statusAtGP", "Pending"] }, 1, 0] },
          },
          published: {
            $sum: { $cond: [{ $eq: ["$statusAtGP", "Published"] }, 1, 0] },
          },
          kpiBreaches: {
            $sum: { $cond: [{ $gt: ["$forwardingLeadTime", 30] }, 1, 0] },
          },
          avgRec: { $avg: "$receivingLeadTime" },
          avgFor: { $avg: "$forwardingLeadTime" },
        },
      },
    ]);

    const data = stats || { total: 0 };
    return res.status(200).json({
      success: true,
      stats: {
        total: data.total,
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
  } catch {
    return res.status(500).json({ message: "Stats generation failed" });
  }
};

/* =========================================================
   RECORD VERIFICATION
========================================================= */
export const verifyRecords = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res
        .status(400)
        .json({ message: "ids must be a non-empty array" });
    }

    const validIds = ids.filter((id: string) => Types.ObjectId.isValid(id));
    // ✅ don't fire updateMany against an empty $in — returns 200 with 0 modified
    if (!validIds.length) {
      return res.status(400).json({ message: "No valid record IDs provided" });
    }

    const result = await Record.updateMany(
      { _id: { $in: validIds } },
      { $set: { statusAtGP: StatusAtGP.PUBLISHED, datePublished: new Date() } }
    );

    return res.status(200).json({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({ message: "Verification failed", error: err.message });
  }
};

/* =========================================================
   GENERAL FETCHES
========================================================= */
export const getAllRecords = async (_req: Request, res: Response) => {
  try {
    const records = await Record.find()
      .select(
        `no causeNo nameOfDeceased dateReceived dateOfReceipt
         dateForwardedToGP receivingLeadTime forwardingLeadTime
         form60Compliance rejectionReason statusAtGP courtStation
         updatedBy lastEditAction createdAt updatedAt`
      )
      .populate("courtStation", "name level")
      .lean();

    return res
      .status(200)
      .json({ success: true, count: records.length, records });
  } catch {
    return res.status(500).json({ message: "Failed to fetch records" });
  }
};

export const getRecordsByCourt = async (
  req: Request<{ courtId: string }>,
  res: Response
) => {
  try {
    const { courtId } = req.params;
    if (!Types.ObjectId.isValid(courtId))
      return res.status(400).json({ message: "Invalid Court ID format" });

    const records = await Record.find({ courtStation: courtId })
      .populate("courtStation", "name")
      .sort({ createdAt: -1 })
      .lean();

    return res
      .status(200)
      .json({ success: true, count: records.length, records });
  } catch {
    return res.status(500).json({ message: "Failed to fetch court records" });
  }
};

export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const { courtId } = req.query;
    const matchQuery =
      courtId && courtId !== "all"
        ? { courtStation: new Types.ObjectId(courtId as string) }
        : {};

    const [results] = await Record.aggregate([
      {
        $facet: {
          summary: [
            { $match: matchQuery },
            {
              $group: {
                _id: null,
                totalRecords: { $sum: 1 },
                compliantCount: {
                  $sum: {
                    $cond: [
                      { $eq: ["$form60Compliance", "Approved"] },
                      1,
                      0,
                    ],
                  },
                },
                nonCompliantCount: {
                  $sum: {
                    $cond: [
                      { $eq: ["$form60Compliance", "Rejected"] },
                      1,
                      0,
                    ],
                  },
                },
                pendingForwarding: {
                  $sum: {
                    $cond: [{ $eq: ["$statusAtGP", "Pending"] }, 1, 0],
                  },
                },
                averageLeadTime: { $avg: "$forwardingLeadTime" },
              },
            },
          ],
          courtPerformance: [
            {
              $group: {
                _id: "$courtStation",
                count: { $sum: 1 },
                complianceRate: {
                  $avg: {
                    $cond: [
                      { $eq: ["$form60Compliance", "Approved"] },
                      100,
                      0,
                    ],
                  },
                },
              },
            },
            {
              $lookup: {
                from: "courts",
                localField: "_id",
                foreignField: "_id",
                as: "courtDetails",
              },
            },
            { $unwind: "$courtDetails" },
            {
              $project: {
                count: 1,
                complianceRate: { $round: ["$complianceRate", 1] },
                courtName: "$courtDetails.name",
              },
            },
            { $sort: { count: -1 } },
          ],
        },
      },
    ]);

    return res.status(200).json({ success: true, data: results });
  } catch (error: any) {
    return res
      .status(500)
      .json({ message: "Analytics failed", error: error.message });
  }
};