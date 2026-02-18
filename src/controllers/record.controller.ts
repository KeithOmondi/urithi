import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import Record, {
  calculateLeadTime,
  Form60Compliance,
  StatusAtGP,
} from "../models/record.model";
import Court, { ICourt } from "../models/court.model";
import { User } from "../models/User";
import { sendEmailToCourt } from "../utils/sendMail";
import { getNextSequence } from "../utils/counter";
import { emailTemplates } from "../utils/emailTemplates";

const BATCH_SIZE = 10;

interface NotifyOptions {
  isForwarding?: boolean;
  checkKpi?: boolean;
}

export const notifyStakeholders = async (
  record: any,
  options: NotifyOptions = {}
) => {
  const { isForwarding = false, checkKpi = false } = options;

  try {
    // 1️⃣ Parallel fetch Court & Admins
    const [court, admins] = await Promise.all([
      Court.findById(record.courtStation).lean<ICourt>(),
      User.find({ role: { $regex: /^admin$/i } })
        .select("email")
        .lean<{ email: string }[]>(),
    ]);

    if (!court) return;

    // 2️⃣ Prepare recipients
    const recipients = Array.from(
      new Set(
        [...admins.map((a) => a.email), court.primaryEmail]
          .filter(Boolean)
          .map((e) => e!.toLowerCase().trim())
      )
    );
    if (!recipients.length) return;

    // 3️⃣ Compute lead time
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

    // 4️⃣ Prepare jobs array
    const jobs: { to: string; subject: string; html: string; text?: string }[] = [];
    let kpiTriggered = false;

    // KPI warning
    if (checkKpi && receiptLeadTime >= 30 && !record.kpiAlertSent) {
      const warning = emailTemplates.leadTimeWarning(emailData);
      recipients.forEach((to) => jobs.push({ to, ...warning }));
      kpiTriggered = true;
    }

    // Record status email
    let template;
    if (isForwarding) {
      template = emailTemplates.recordForwarded(emailData);
    } else if (record.form60Compliance === Form60Compliance.REJECTED) {
      template = emailTemplates.recordRejected(emailData);
    } else {
      template = emailTemplates.recordApproved(emailData);
    }
    recipients.forEach((to) => jobs.push({ to, ...template }));

    // 5️⃣ Batch execution
    for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
      const batch = jobs.slice(i, i + BATCH_SIZE);
      await Promise.allSettled(
        batch.map((job) =>
          sendEmailToCourt(court._id.toString(), job.subject, job.html, job.text)
        )
      );
    }

    // 6️⃣ Update KPI flag
    if (kpiTriggered) {
      await Record.findByIdAndUpdate(record._id, { $set: { kpiAlertSent: true } });
    }
  } catch (error) {
    console.error(`Notification error for record ${record._id}:`, error);
  }
};

export const createRecord = async (req: Request, res: Response) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const nextNo = await getNextSequence("record");

    const [record] = await Record.create(
      [
        {
          ...req.body,
          no: nextNo,
          causeNo: req.body.causeNo.toUpperCase().trim(),
          kpiAlertSent: false,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    // Background notification
    notifyStakeholders(record.toObject(), { checkKpi: true });

    return res.status(201).json(record);
  } catch (err: any) {
    await session.abortTransaction();
    return res.status(500).json({ message: err.message });
  } finally {
    session.endSession();
  }
};

export const updateRecord = async (
  req: Request<{ id: string }> & { user?: any },
  res: Response,
) => {
  try {
    const record = await Record.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    const updates = Object.keys(req.body);
    Object.assign(record, req.body);
    record.updatedBy = req.user?.id;
    record.lastEditAction = `Updated fields: ${updates.join(", ")}`;

    await record.save();

    const updatedDoc = await Record.findById(record._id)
      .populate("courtStation", "name level")
      .populate("updatedBy", "firstName lastName pjNumber")
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

export const getRecordById = async (
  req: Request<{ id: string }>,
  res: Response,
) => {
  try {
    const record = await Record.findById(req.params.id)
      .populate("courtStation", "name level")
      .populate("updatedBy", "firstName lastName pjNumber")
      .lean();

    if (!record) return res.status(404).json({ message: "Record not found" });
    return res.status(200).json(record);
  } catch {
    return res.status(500).json({ message: "Failed to fetch record" });
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

export const updateMultipleRecordsDateForwarded = async (
  req: any,
  res: Response,
) => {
  try {
    const { ids, date } = req.body;
    const validIds = ids.filter((id: string) => Types.ObjectId.isValid(id));
    const newForwardedDate = new Date(date);

    const records = await Record.find({ _id: { $in: validIds } });

    const operations = records.map((doc) => ({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            dateForwardedToGP: newForwardedDate,
            forwardingLeadTime: calculateLeadTime(
              doc.dateReceived,
              newForwardedDate,
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
      .populate("updatedBy", "firstName lastName pjNumber");

    updatedRecords.forEach((r) =>
      notifyStakeholders(r.toObject(), { isForwarding: true }),
    );

    return res
      .status(200)
      .json({
        success: true,
        modifiedCount: operations.length,
        records: updatedRecords,
      });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

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
   VERIFICATION & BATCH UPDATES
========================================================= */

/**
 * Marks multiple records as Published once verified.
 */
export const verifyRecords = async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res
        .status(400)
        .json({ message: "Invalid input: ids must be an array" });
    }

    const validIds = ids.filter((id: string) => Types.ObjectId.isValid(id));

    const result = await Record.updateMany(
      { _id: { $in: validIds } },
      {
        $set: {
          statusAtGP: StatusAtGP.PUBLISHED,
          datePublished: new Date(),
        },
      },
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
   FETCHING & LISTS
========================================================= */

/**
 * Retrieves all records with essential administrative fields.
 */
export const getAllRecords = async (_req: Request, res: Response) => {
  try {
    const records = await Record.find()
      .select(
        `
        no causeNo nameOfDeceased dateReceived dateOfReceipt 
        dateForwardedToGP receivingLeadTime forwardingLeadTime 
        form60Compliance rejectionReason statusAtGP courtStation 
        updatedBy lastEditAction createdAt updatedAt
      `,
      )
      .populate("courtStation", "name level")
      .populate("updatedBy", "firstName lastName pjNumber")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (err: any) {
    return res.status(500).json({ message: "Failed to fetch records" });
  }
};

/**
 * Filters records by a specific court station.
 */
export const getRecordsByCourt = async (
  req: Request<{ courtId: string }>,
  res: Response,
) => {
  try {
    const { courtId } = req.params;

    if (!Types.ObjectId.isValid(courtId)) {
      return res.status(400).json({ message: "Invalid Court ID format" });
    }

    const records = await Record.find({ courtStation: courtId })
      .populate("courtStation", "name")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: records.length,
      records,
    });
  } catch (err: any) {
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
                    $cond: [{ $eq: ["$form60Compliance", "Approved"] }, 1, 0],
                  },
                },
                nonCompliantCount: {
                  $sum: {
                    $cond: [{ $eq: ["$form60Compliance", "Rejected"] }, 1, 0],
                  },
                },
                pendingForwarding: {
                  $sum: { $cond: [{ $eq: ["$statusAtGP", "Pending"] }, 1, 0] },
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
                    $cond: [{ $eq: ["$form60Compliance", "Approved"] }, 100, 0],
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
