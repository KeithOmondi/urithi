import { Request, Response } from "express";
import Record from "../models/record.model";
import mongoose from "mongoose";

export const getRegistryAnalytics = async (req: Request, res: Response) => {
  try {
    const { courtId, startDate, endDate } = req.query;

    // Build filter
    const matchQuery: any = {};
    if (courtId && courtId !== "all") {
      matchQuery.courtStation = new mongoose.Types.ObjectId(courtId as string);
    }
    if (startDate || endDate) {
      matchQuery.dateReceived = {};
      if (startDate) matchQuery.dateReceived.$gte = new Date(startDate as string);
      if (endDate) matchQuery.dateReceived.$lte = new Date(endDate as string);
    }

    const stats = await Record.aggregate([
      { $match: matchQuery },
      {
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                totalRecords: { $sum: 1 },
                approvedCount: { $sum: { $cond: [{ $eq: ["$form60Compliance", "Approved"] }, 1, 0] } },
                rejectedCount: { $sum: { $cond: [{ $eq: ["$form60Compliance", "Rejected"] }, 1, 0] } },
                pendingCount: { $sum: { $cond: [{ $eq: ["$statusAtGP", "Pending"] }, 1, 0] } },
                publishedCount: { $sum: { $cond: [{ $eq: ["$statusAtGP", "Published"] }, 1, 0] } },
                avgReceivingTime: { $avg: { $ifNull: ["$receivingLeadTime", 0] } },
                avgForwardingTime: { $avg: { $ifNull: ["$forwardingLeadTime", 0] } },
                kpiBreaches: { $sum: { $cond: [{ $gt: ["$forwardingLeadTime", 30] }, 1, 0] } },
              },
            },
          ],
          courtPerformance: [
            {
              $group: {
                _id: "$courtStation",
                count: { $sum: 1 },
                avgForwardingTime: { $avg: { $ifNull: ["$forwardingLeadTime", 0] } },
              },
            },
            { $sort: { avgForwardingTime: 1 } },
            {
              $lookup: {
                from: "courts",
                localField: "_id",
                foreignField: "_id",
                as: "courtInfo",
              },
            },
            { $unwind: "$courtInfo" },
          ],
        },
      },
    ]);

    res.status(200).json({ success: true, data: stats[0] });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
