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
  options?: { isForwarding?: boolean; checkKpi?: boolean },
) => {
  const { isForwarding = false, checkKpi = false } = options || {};

  const [court, admins] = await Promise.all([
    Court.findById(record.courtStation).lean<ICourt>(),
    User.find({ role: "Admin", accountVerified: true })
      .select("email")
      .lean(),
  ]);

  const adminEmails = admins.map((a) => a.email);
  const courtEmail = court?.primaryEmail;
  const recipients = [...adminEmails, courtEmail].filter(Boolean) as string[];

  const receiptLeadTime =
    calculateLeadTime(record.dateOfReceipt, record.dateReceived) ?? 0;

  const forwardingLeadTime =
    calculateLeadTime(record.dateReceived, record.dateForwardedToGP) ?? 0;

  const emailData = {
    causeNo: record.causeNo,
    deceasedName: record.nameOfDeceased,
    courtName: court?.name || "Registry Station",
    reason: record.rejectionReason || "No reason provided",
    leadTime: isForwarding ? forwardingLeadTime : receiptLeadTime,
    approvalDate: record.dateReceived || record.updatedAt,
  };

  const jobs: Promise<any>[] = [];

  /* KPI ONLY ON CREATE */
  if (checkKpi && receiptLeadTime > 30 && !record.kpiAlertSent) {
    const warning = emailTemplates.leadTimeWarning(emailData);

    adminEmails.forEach((email) =>
      jobs.push(
        sendMail({
          to: email,
          subject: warning.subject,
          html: warning.html,
        }),
      ),
    );

    await Record.findByIdAndUpdate(record._id, {
      $set: { kpiAlertSent: true },
    });
  }

  let template;
  if (isForwarding) {
    template = emailTemplates.recordForwarded(emailData);
  } else if (record.form60Compliance === Form60Compliance.REJECTED) {
    template = emailTemplates.recordRejected(emailData);
  } else {
    template = emailTemplates.recordApproved(emailData);
  }

  recipients.forEach((email) =>
    jobs.push(
      sendMail({
        to: email,
        subject: template.subject,
        html: template.html,
      }),
    ),
  );

  await Promise.allSettled(jobs);
};

/* =========================================================
   CREATE
========================================================= */

export const createRecord = async (req: Request, res: Response) => {
  const { causeNo } = req.body as CreateRecordBody;
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

    notifyStakeholders(record.toObject(), { checkKpi: true }).catch(console.error);

    return res.status(201).json(record);
  } catch (err: any) {
    if (session.inTransaction()) await session.abortTransaction();

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

/* =========================================================
   UPDATE (SAFE PATCH STYLE)
========================================================= */

export const updateRecord = async (
  req: Request<{ id: string }> & { user?: any },
  res: Response,
) => {
  try {
    const record = await Record.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Record not found" });

    const updates = Object.keys(req.body);
    const logMessage = updates.length > 0 ? `Updated: ${updates.join(", ")}` : "No changes detected";

    // Apply updates
    Object.assign(record, req.body);

    // Audit fields
    record.updatedBy = req.user?.id;
    record.lastEditAction = logMessage;

    await record.save(); // triggers pre-save hooks

    // Populate after save
    await record.populate("courtStation", "name level");
    await record.populate("updatedBy", "firstName lastName pjNumber");

    const isForwarding = "dateForwardedToGP" in req.body;

    notifyStakeholders(record.toObject(), { isForwarding, checkKpi: false }).catch(console.error);

    return res.status(200).json(record);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};



/* =========================================================
   FETCH ALL (ADMIN SAFE)
========================================================= */

export const getAllRecords = async (_req: Request, res: Response) => {
  try {
    const records = await Record.find()
      .select(`
        no
        causeNo
        nameOfDeceased
        dateReceived
        dateOfReceipt
        dateForwardedToGP
        receivingLeadTime
        forwardingLeadTime
        form60Compliance
        rejectionReason
        statusAtGP
        courtStation
        updatedBy
        lastEditAction
        createdAt
        updatedAt
      `)
      .populate("courtStation", "name level")
      .populate("updatedBy", "firstName lastName pjNumber")
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

/* =========================================================
   FETCH ONE
========================================================= */

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

/* =========================================================
   BULK UPDATE (SAFE)
========================================================= */

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

    const updatedRecords = await Record.find({
      _id: { $in: validIds },
    })
      .populate("courtStation", "name level")
      .populate("updatedBy", "firstName lastName pjNumber");

    updatedRecords.forEach((r) =>
      notifyStakeholders(r.toObject(), {
        isForwarding: true,
        checkKpi: false,
      }).catch(console.error),
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

/*==============================================
GET RECORDS BY COURT
================================================*/
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


/* =========================================================
    ANALYTICS (Corrected Types)
========================================================= */

export const getAnalytics = async (req: Request, res: Response) => {
  try {
    const { courtId } = req.query;
    const matchQuery = courtId && courtId !== "all" 
      ? { courtStation: new Types.ObjectId(courtId as string) } 
      : {};

    const stats = await Record.aggregate([
      {
        $facet: {
          summary: [
            { $match: matchQuery },
            {
              $group: {
                _id: null,
                totalRecords: { $sum: 1 },
                compliantCount: { $sum: { $cond: [{ $eq: ["$form60Compliance", "Approved"] }, 1, 0] } },
                nonCompliantCount: { $sum: { $cond: [{ $eq: ["$form60Compliance", "Rejected"] }, 1, 0] } },
                pendingForwarding: { $sum: { $cond: [{ $eq: ["$statusAtGP", "Pending"] }, 1, 0] } },
                averageLeadTime: { $avg: "$forwardingLeadTime" }
              }
            }
          ],
          courtPerformance: [
            // 1. Group by the Court ID
            {
              $group: {
                _id: "$courtStation",
                count: { $sum: 1 },
                complianceRate: { 
                  $avg: { $cond: [{ $eq: ["$form60Compliance", "Approved"] }, 100, 0] } 
                }
              }
            },
            // 2. Join with the Courts collection to get the name
            {
              $lookup: {
                from: "courts", // MUST match the actual name of your courts collection in MongoDB
                localField: "_id",
                foreignField: "_id",
                as: "courtDetails"
              }
            },
            // 3. Convert the courtDetails array into a single object
            { $unwind: "$courtDetails" },
            // 4. Project the final fields (Replace the ID with the actual name)
            {
              $project: {
                _id: 1,
                count: 1,
                complianceRate: { $round: ["$complianceRate", 1] },
                courtName: "$courtDetails.name" // This is where the actual name comes from
              }
            },
            { $sort: { count: -1 } }
          ]
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      data: stats[0]
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Internal Server Error";
    return res.status(500).json({ 
      message: "Analytics aggregation failed", 
      error: errorMessage 
    });
  }
};
