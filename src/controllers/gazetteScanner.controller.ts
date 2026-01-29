import { Request, Response } from "express";
import asyncHandler from "express-async-handler";
import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";

import ScannedGazetteModel from "../models/ScannedGazette.model";
import Record from "../models/record.model";
import ScanLog from "../models/scanLog.model";

const execFileAsync = promisify(execFile);

/* =====================================
   CONFIG: Absolute path to pdftotext
===================================== */
const PDFTOTEXT_PATH =
  "C:\\Users\\User\\Downloads\\p\\poppler-25.12.0\\Library\\bin\\pdftotext.exe";

/* =====================================
   TYPES
===================================== */
interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string };
  file?: Express.Multer.File;
}

/* =====================================
   HELPER: Extract text from PDF
===================================== */
const extractPdfText = async (pdfPath: string): Promise<string> => {
  const txtPath = pdfPath.replace(".pdf", ".txt");

  // Run pdftotext
  await execFileAsync(PDFTOTEXT_PATH, ["-layout", pdfPath, txtPath]);

  // Read generated text
  const text = await fs.readFile(txtPath, "utf8");

  // Clean up
  await fs.unlink(txtPath).catch(() => {});

  return text.replace(/\s+/g, " ").trim();
};

/* =====================================
   CONTROLLER
===================================== */
export const scanGazette = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthenticatedRequest;

  if (!authReq.user?.id) {
    res.status(401);
    throw new Error("User not authenticated");
  }

  if (!authReq.file) {
    res.status(400);
    throw new Error("No PDF uploaded");
  }

  const userId = authReq.user.id;
  const filePath = authReq.file.path;

  try {
    /* -------------------------------------
       1. Parse PDF
    ------------------------------------- */
    const text = await extractPdfText(filePath);
    if (!text) throw new Error("PDF text extraction failed");

    /* -------------------------------------
       2. Extract metadata
    ------------------------------------- */
    const volumeMatch = text.match(/Vol\.?\s*[A-Z]*\s*[—-]?\s*No\.?\s*\d+/i);
    const dateMatch = text.match(
      /\b\d{1,2}(st|nd|rd|th)?\s+(January|February|March|April|May|June|July|August|September|October|November|December)[,]?\s+\d{4}\b/i
    );

    const volumeNo = volumeMatch?.[0] ?? "Unknown";
    const datePublished = dateMatch
      ? new Date(dateMatch[0].replace(/(st|nd|rd|th)/, ""))
      : new Date();

    /* -------------------------------------
       3. Extract case details
    ------------------------------------- */
    const sections = text.split(/IN THE HIGH COURT OF KENYA AT\s+/i).slice(1);
    const extractedCases: any[] = [];
    const namesToSearch: string[] = [];

    for (const section of sections) {
      const courtName =
        section.match(/^([A-Z\s]+)/i)?.[1]?.trim().toUpperCase() || "UNKNOWN";

      const causeBlocks =
        section.match(/CAUSE\s+NO\.\s*[\w/]+.*?(?=CAUSE\s+NO\.|GAZETTE NOTICE|$)/gis) || [];

      for (const block of causeBlocks) {
        const deceasedMatch = block.match(
          /estate\s+of\s+([A-Z\s.'’]+?)(?=,|\slate|\swho|\sdeceased)/i
        );

        if (!deceasedMatch) continue;

        const nameOfDeceased = deceasedMatch[1].toLowerCase().trim();
        const causeNo =
          block.match(/CAUSE\s+NO\.\s*[\w/]+/i)?.[0]?.replace(/CAUSE\s+NO\./i, "").trim() || "N/A";

        extractedCases.push({ causeNo, courtName, nameOfDeceased });
        namesToSearch.push(nameOfDeceased);
      }
    }

    /* -------------------------------------
       4. Match against database
    ------------------------------------- */
    const existingRecords = await Record.find({
      nameOfDeceased: { $in: namesToSearch },
    }).select("_id nameOfDeceased courtStation dateForwardedToGP");

    const recordMap = new Map(existingRecords.map(r => [r.nameOfDeceased.toLowerCase(), r]));
    const matchedCases: any[] = [];
    const bulkOps: any[] = [];

    for (const c of extractedCases) {
      const record = recordMap.get(c.nameOfDeceased);
      if (!record) continue;

      let leadTimeDays: number | null = null;
      if (record.dateForwardedToGP) {
        leadTimeDays = Math.floor(
          (datePublished.getTime() - new Date(record.dateForwardedToGP).getTime()) /
          (1000 * 3600 * 24)
        );
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: record._id },
          update: {
            $set: {
              statusAtGP: "Published",
              volumeNo,
              datePublished,
              leadTimeGPToPub: leadTimeDays,
            },
          },
        },
      });

      matchedCases.push({
        ...c,
        recordId: record._id,
        courtStation: record.courtStation,
        dateForwardedToGP: record.dateForwardedToGP,
        leadTimeDays: leadTimeDays ?? "N/A",
      });
    }

    if (bulkOps.length) await Record.bulkWrite(bulkOps);

    /* -------------------------------------
       5. Save scanned gazette & log
    ------------------------------------- */
    const scannedGazette = await ScannedGazetteModel.create({
      uploadedBy: userId,
      fileName: authReq.file.originalname,
      volumeNo,
      datePublished,
      totalRecords: extractedCases.length,
      publishedCount: matchedCases.length,
      cases: matchedCases,
    });

    await ScanLog.create({
      uploadedBy: userId,
      fileName: authReq.file.originalname,
      totalRecords: extractedCases.length,
      publishedCount: matchedCases.length,
      volumeNo,
      datePublished,
      remarks: `Processed ${extractedCases.length} records. Found ${matchedCases.length} matches.`,
    });

    res.status(201).json({
      success: true,
      gazette: scannedGazette,
      tableData: matchedCases,
    });

  } finally {
    // Cleanup uploaded PDF
    await fs.unlink(filePath).catch(() => {});
  }
});
