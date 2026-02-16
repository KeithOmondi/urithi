import { Request, Response } from "express";
import { Types } from "mongoose";
import Record, { StatusAtGP } from "../models/record.model";

/**
 * @desc    Delete a record (Destructive action - Admin only)
 * @route   DELETE /api/admin/records/:id
 */
export const deleteRecord = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const deleted = await Record.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Record not found" });
    
    return res.status(200).json({ 
      success: true, 
      message: "Record permanently removed from registry" 
    });
  } catch (err) {
    return res.status(500).json({ message: "Delete operation failed" });
  }
};

/**
 * @desc    Get dashboard analytics with court filtering
 * @route   GET /api/admin/analytics
 */
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
            { $group: { _id: "$courtStation", count: { $sum: 1 }, complianceRate: { $avg: { $cond: [{ $eq: ["$form60Compliance", "Approved"] }, 100, 0] } } } },
            { $lookup: { from: "courts", localField: "_id", foreignField: "_id", as: "courtDetails" } },
            { $unwind: "$courtDetails" },
            { $project: { _id: 1, count: 1, complianceRate: { $round: ["$complianceRate", 1] }, courtName: "$courtDetails.name" } },
            { $sort: { count: -1 } }
          ]
        }
      }
    ]);

    return res.status(200).json({ success: true, data: stats[0] });
  } catch (error: any) {
    return res.status(500).json({ message: "Analytics failure", error: error.message });
  }
};

/**
 * @desc    Bulk Verify/Publish records to GP
 * @route   POST /api/admin/records/verify-bulk
 */
export const verifyRecords = async (req: Request, res: Response) => {
  try {
    const validIds = req.body.ids.filter(Types.ObjectId.isValid);
    const result = await Record.updateMany(
      { _id: { $in: validIds } },
      { $set: { statusAtGP: StatusAtGP.PUBLISHED, datePublished: new Date() } }
    );
    return res.status(200).json({ success: true, modifiedCount: result.modifiedCount });
  } catch {
    return res.status(500).json({ message: "Bulk verification failed" });
  }
};

export const getRecordsForAdmin = async (req: Request, res: Response) => {
  try {
    const { page = "1", limit = "10", search = "", court, compliance, kpi } = req.query as any;
    const limitNum = Math.min(Number(limit), 100);
    const query: any = {};

    if (court && Types.ObjectId.isValid(court)) query.courtStation = court;
    if (compliance) query.form60Compliance = compliance;
    if (kpi === "breached") query.forwardingLeadTime = { $gt: 30 };
    if (search) query.$text = { $search: search };

    const [records, total] = await Promise.all([
      Record.find(query).sort({ createdAt: -1 }).skip((Number(page) - 1) * limitNum).limit(limitNum).populate("courtStation", "name").lean(),
      Record.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, records, pagination: { total, page: Number(page), pages: Math.ceil(total / limitNum) } });
  } catch {
    return res.status(500).json({ message: "Admin fetch failure" });
  }
};



