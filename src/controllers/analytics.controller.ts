import { Request, Response } from "express";
import { PipelineStage, Types } from "mongoose";
import Record from "../models/record.model";

export const getMonthlyAnalytics = async (req: Request, res: Response) => {
  try {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const courtIds = req.query.courtIds as string[] | undefined;

    const matchStage: Record<string, any> = {
      dateReceived: {
        $gte: new Date(`${year}-01-01T00:00:00.000Z`),
        $lte: new Date(`${year}-12-31T23:59:59.999Z`),
      },
    };

    if (courtIds?.length) {
      matchStage.courtStation = {
        $in: courtIds.map((id) => new Types.ObjectId(id)),
      };
    }

    //import { Types, PipelineStage } from "mongoose";

const pipeline: PipelineStage[] = [
  { $match: matchStage },
  {
    $group: {
      _id: { court: "$courtStation", month: { $month: "$dateReceived" } },
      count: { $sum: 1 },
      approved: { $sum: { $cond: [{ $eq: ["$form60Compliance", "Approved"] }, 1, 0] } },
      rejected: { $sum: { $cond: [{ $eq: ["$form60Compliance", "Rejected"] }, 1, 0] } },
      published: { $sum: { $cond: [{ $eq: ["$statusAtGP", "Published"] }, 1, 0] } },
      avgReceivingLeadTime: { $avg: "$receivingLeadTime" },
      avgForwardingLeadTime: { $avg: "$forwardingLeadTime" },
    },
  },
  { $lookup: { from: "courts", localField: "_id.court", foreignField: "_id", as: "court" } },
  { $unwind: "$court" },
  {
    $project: {
      _id: 0,
      courtId: "$_id.court",
      courtName: "$court.name",
      courtLevel: "$court.level",
      month: "$_id.month",
      count: 1,
      approved: 1,
      rejected: 1,
      published: 1,
      avgReceivingLeadTime: { $round: ["$avgReceivingLeadTime", 1] },
      avgForwardingLeadTime: { $round: ["$avgForwardingLeadTime", 1] },
    },
  },
  { $sort: { courtName: 1, month: 1 } },
];

    const rows = await Record.aggregate(pipeline);

    const shaped: Record<string, any> = {};
    for (const row of rows) {
      const cid = row.courtId.toString();
      if (!shaped[cid]) {
        shaped[cid] = { name: row.courtName, level: row.courtLevel, monthly: {} };
      }
      shaped[cid].monthly[row.month] = {
        count: row.count,
        approved: row.approved,
        rejected: row.rejected,
        published: row.published,
        avgReceivingLeadTime: row.avgReceivingLeadTime,
        avgForwardingLeadTime: row.avgForwardingLeadTime,
      };
    }

    return res.json({ year, data: shaped });
  } catch (err) {
    console.error("[analytics/monthly]", err);
    return res.status(500).json({ message: "Failed to fetch analytics" });
  }
};