import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import Record, { StatusAtGP } from "../models/record.model";
import {
  extractCauseNosFromPdf,
  ParsedCauseNo,
} from "../utils/gazetteParser";
import { sendEmailToCourt } from "../utils/sendMail";
import { AppError } from "../errors/AppError";

/* =========================================================
   TYPES
========================================================= */
interface NormalizedEntry {
  original: string;
  key: string;
}

interface MatchedRecord {
  _id: string;
  causeNo: string;
  nameOfDeceased: string;
  courtStation: string;
  previousStatus: string;
  newStatus: string;
}

interface AlreadyPublishedRecord {
  _id: string;
  causeNo: string;
  nameOfDeceased: string;
  datePublished: Date;
}

interface ScanSummary {
  totalInGazette: number;
  totalMatched: number;
  totalAlreadyPublished: number;
  totalNotInDb: number;
  totalNotInGazette: number;
  newlyMarkedPublished: number;
}

interface ScanResult {
  matched: MatchedRecord[];
  alreadyPublished: AlreadyPublishedRecord[];
  notInDb: string[];
  notInGazette: string[];
  summary: ScanSummary;
}

/* =========================================================
   HELPER: Normalize causeNo for comparison
   Handles:
   - "E528/2024"
   - "E528 OF 2024"
   - "CAUSE NO. E528 OF 2024"
========================================================= */
const normalizeCauseNo = (raw: string): string => {
  return raw
    .toUpperCase()
    .replace(/CAUSE\s+NO\.?\s*/i, "")
    .replace(/\s+OF\s+/i, "/")
    .replace(/[\s-]/g, "")
    .trim();
};

/* =========================================================
   PREVIEW SCAN — No DB writes
   POST /api/scanner/scan/preview
   Body: multipart/form-data  field: "gazette" (PDF)
========================================================= */
export const previewScan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      return next(new AppError("No PDF file uploaded", 400));
    }

    const parsedCauseNos: ParsedCauseNo[] = await extractCauseNosFromPdf(
      req.file.buffer
    );

    if (parsedCauseNos.length === 0) {
      return next(
        new AppError(
          "No cause numbers found in the uploaded PDF. Please check the file.",
          422
        )
      );
    }

    // Build normalized gazette entries
    const gazetteNormalized: NormalizedEntry[] = parsedCauseNos.map(
      (p: ParsedCauseNo) => ({
        original: p.normalized,
        key: normalizeCauseNo(p.raw),
      })
    );

    // Only forwarded records are candidates for matching
    const forwardedRecords = await Record.find({
      dateForwardedToGP: { $exists: true, $ne: null },
    })
      .populate("courtStation", "name")
      .lean();

    // Map: normalizedKey → record
    const dbMap = new Map<string, any>();
    forwardedRecords.forEach((r) => {
      dbMap.set(normalizeCauseNo(r.causeNo), r);
    });

    const gazetteKeys = new Set<string>(
      gazetteNormalized.map((g: NormalizedEntry) => g.key)
    );
    const dbKeys = new Set<string>(dbMap.keys());

    // --- Classify matches ---
    const matched: MatchedRecord[] = [];
    const alreadyPublished: AlreadyPublishedRecord[] = [];

    gazetteNormalized.forEach(({ key, original }: NormalizedEntry) => {
      const record = dbMap.get(key);
      if (!record) return;

      if (record.statusAtGP === StatusAtGP.PUBLISHED) {
        alreadyPublished.push({
          _id: record._id.toString(),
          causeNo: record.causeNo,
          nameOfDeceased: record.nameOfDeceased,
          datePublished: record.datePublished,
        });
      } else {
        matched.push({
          _id: record._id.toString(),
          causeNo: record.causeNo,
          nameOfDeceased: record.nameOfDeceased,
          courtStation:
            (record.courtStation as any)?.name ?? String(record.courtStation),
          previousStatus: record.statusAtGP,
          newStatus: StatusAtGP.PUBLISHED,
        });
      }
    });

    // --- In gazette but NOT in DB ---
    const notInDb: string[] = gazetteNormalized
      .filter(({ key }: NormalizedEntry) => !dbKeys.has(key))
      .map(({ original }: NormalizedEntry) => original);

    // --- Forwarded in DB but NOT in gazette ---
    const notInGazette: string[] = [];
    dbKeys.forEach((key: string) => {
      if (!gazetteKeys.has(key)) {
        const record = dbMap.get(key);
        if (record && record.statusAtGP !== StatusAtGP.PUBLISHED) {
          notInGazette.push(record.causeNo);
        }
      }
    });

    const result: ScanResult = {
      matched,
      alreadyPublished,
      notInDb,
      notInGazette,
      summary: {
        totalInGazette: parsedCauseNos.length,
        totalMatched: matched.length,
        totalAlreadyPublished: alreadyPublished.length,
        totalNotInDb: notInDb.length,
        totalNotInGazette: notInGazette.length,
        newlyMarkedPublished: matched.length,
      },
    };

    res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    next(new AppError(err.message || "Scan preview failed", 500));
  }
};

/* =========================================================
   CONFIRM SCAN — Writes to DB + sends emails
   POST /api/scanner/scan/confirm
   Body: { ids: string[] }
========================================================= */
export const confirmScan = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { ids } = req.body as { ids: string[] };

    if (!Array.isArray(ids) || ids.length === 0) {
      return next(
        new AppError("ids must be a non-empty array of record IDs", 400)
      );
    }

    const validIds = ids.filter((id: string) => Types.ObjectId.isValid(id));

    if (validIds.length === 0) {
      return next(new AppError("No valid ObjectIds provided", 400));
    }

    // Fetch before updating so we have court info for emails
    const records = await Record.find({ _id: { $in: validIds } })
      .populate("courtStation", "name _id")
      .lean();

    // Bulk update
    const updateResult = await Record.updateMany(
      {
        _id: { $in: validIds },
        statusAtGP: { $ne: StatusAtGP.PUBLISHED },
      },
      {
        $set: {
          statusAtGP: StatusAtGP.PUBLISHED,
          datePublished: new Date(),
        },
      }
    );

    // Notify courts grouped (one email per court)
    await notifyCourtsBulk(records);

    res.status(200).json({
      success: true,
      modifiedCount: updateResult.modifiedCount,
      message: `${updateResult.modifiedCount} record(s) marked as published.`,
    });
  } catch (err: any) {
    next(new AppError(err.message || "Confirm scan failed", 500));
  }
};

/* =========================================================
   ONE-SHOT SCAN + PUBLISH
   POST /api/scanner/scan
   Body: multipart/form-data  field: "gazette" (PDF)
========================================================= */
export const scanAndPublish = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      return next(new AppError("No PDF file uploaded", 400));
    }

    const parsedCauseNos: ParsedCauseNo[] = await extractCauseNosFromPdf(
      req.file.buffer
    );

    if (parsedCauseNos.length === 0) {
      return next(
        new AppError("No cause numbers found in the uploaded PDF.", 422)
      );
    }

    const gazetteNormalized: NormalizedEntry[] = parsedCauseNos.map(
      (p: ParsedCauseNo) => ({
        original: p.normalized,
        key: normalizeCauseNo(p.raw),
      })
    );

    // Only look at forwarded, unpublished records
    const forwardedRecords = await Record.find({
      dateForwardedToGP: { $exists: true, $ne: null },
      statusAtGP: { $ne: StatusAtGP.PUBLISHED },
    })
      .populate("courtStation", "name _id")
      .lean();

    const dbMap = new Map<string, any>();
    forwardedRecords.forEach((r) => {
      dbMap.set(normalizeCauseNo(r.causeNo), r);
    });

    // Find matches
    const matchedRecords: any[] = [];
    gazetteNormalized.forEach(({ key }: NormalizedEntry) => {
      const record = dbMap.get(key);
      if (record) matchedRecords.push(record);
    });

    if (matchedRecords.length === 0) {
      res.status(200).json({
        success: true,
        message: "Scan complete. No matching records found to update.",
        modifiedCount: 0,
      });
      return;
    }

    const matchedIds = matchedRecords.map((r) => r._id);

    const updateResult = await Record.updateMany(
      { _id: { $in: matchedIds } },
      {
        $set: {
          statusAtGP: StatusAtGP.PUBLISHED,
          datePublished: new Date(),
        },
      }
    );

    await notifyCourtsBulk(matchedRecords);

    res.status(200).json({
      success: true,
      message: `Scan complete. ${updateResult.modifiedCount} record(s) marked as published.`,
      modifiedCount: updateResult.modifiedCount,
      published: matchedRecords.map((r) => ({
        _id: r._id,
        causeNo: r.causeNo,
        nameOfDeceased: r.nameOfDeceased,
        court: (r.courtStation as any)?.name ?? String(r.courtStation),
      })),
    });
  } catch (err: any) {
    next(new AppError(err.message || "Scan failed", 500));
  }
};

/* =========================================================
   HELPER: One email per court, lists all their published records
========================================================= */
const notifyCourtsBulk = async (records: any[]): Promise<void> => {
  const courtMap = new Map<string, any[]>();

  records.forEach((record) => {
    const courtId: string | null =
      record.courtStation?._id?.toString() ??
      record.courtStation?.toString() ??
      null;

    if (!courtId) return;

    if (!courtMap.has(courtId)) {
      courtMap.set(courtId, []);
    }
    courtMap.get(courtId)!.push(record);
  });

  const emailJobs = Array.from(courtMap.entries()).map(
    async ([courtId, courtRecords]: [string, any[]]) => {
      try {
        const courtName: string =
          courtRecords[0]?.courtStation?.name ?? "Your Court";

        const recordList: string = courtRecords
          .map(
            (r: any) =>
              `<li><strong>${r.causeNo}</strong> — ${r.nameOfDeceased}</li>`
          )
          .join("");

        const subject = `Gazette Publication Notice — ${courtRecords.length} Record(s) Published`;
        const html = `
          <p>Dear ${courtName},</p>
          <p>The following ${courtRecords.length} record(s) from your court 
          have been confirmed as published in the Kenya Gazette:</p>
          <ul>${recordList}</ul>
          <p>These records have been updated to <strong>Published</strong> 
          status in the system.</p>
          <p>Regards,<br/>Government Printer Registry</p>
        `;

        await sendEmailToCourt(courtId, subject, html);
      } catch (err) {
        console.error(`Failed to notify court ${courtId}:`, err);
      }
    }
  );

  await Promise.allSettled(emailJobs);
};