// controllers/report.controller.ts
import { Request, Response } from "express";
import Record from "../models/record.model";
import mongoose from "mongoose";

export const getRegistryAnalytics = async (req: Request, res: Response) => {
  try {
    const { courtId } = req.query;

    // Optional Filter: If courtId is provided, focus the entire report on that station
    const matchQuery = courtId && courtId !== "all" 
      ? { courtStation: new mongoose.Types.ObjectId(courtId as string) } 
      : {};

    const stats = await Record.aggregate([
      { $match: matchQuery },
      {
        $facet: {
          // 1. Overall Totals
          summary: [
            {
              $group: {
                _id: null,
                totalRecords: { $sum: 1 },
                avgForwardingTime: { $avg: "$forwardingLeadTime" },
                avgReceivingTime: { $avg: "$receivingLeadTime" },
                breachCount: { 
                  $sum: { $cond: [{ $gt: ["$forwardingLeadTime", 30] }, 1, 0] } 
                },
                approvedCount: {
                  $sum: { $cond: [{ $eq: ["$form60Compliance", "Approved"] }, 1, 0] }
                }
              }
            }
          ],
          // 2. Performance by Court
          courtPerformance: [
            {
              $group: {
                _id: "$courtStation",
                avgFwd: { $avg: "$forwardingLeadTime" },
                count: { $sum: 1 }
              }
            },
            { $sort: { avgFwd: 1 } },
            {
              $lookup: {
                from: "courts",
                localField: "_id",
                foreignField: "_id",
                as: "courtInfo"
              }
            },
            { $unwind: "$courtInfo" }
          ]
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats[0]
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};