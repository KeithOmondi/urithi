// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
pdfjsLib.GlobalWorkerOptions.workerSrc = "";

import { normalizeDate } from "../utils/regexPatterns";
import { ProbateRecord } from "../types";
import { AppError } from "../controllers/extractorController";

const toAppError = (error: unknown): AppError => {
  if (error instanceof AppError) return error;
  if (error instanceof Error) return new AppError(error.message);
  return new AppError("An unexpected error occurred");
};

/* =========================================================
   PDF TEXT EXTRACTION
   Item-aware: preserve item boundaries with a sentinel
   so we can detect word splits like "N AIROBI" → "NAIROBI"
========================================================= */
async function extractTextWithPdfjs(pdfBuffer: Buffer): Promise<string> {
  if (!pdfBuffer || pdfBuffer.length === 0) {
    throw new AppError("File buffer is empty", 400);
  }

  const uint8Array = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });

  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Join items — if an item ends mid-word (no space, next starts with lowercase
    // or continuation), join without space; otherwise join with space.
    const items = content.items.map((item: { str?: string }) => item.str ?? "");
    let pageText = "";
    for (let j = 0; j < items.length; j++) {
      const curr = items[j];
      const next = items[j + 1] ?? "";
      pageText += curr;
      // Add space between items unless current ends with hyphen or next starts
      // with lowercase (continuation of split word like "N" + "AIROBI")
      if (curr && next) {
        const currEndsAlpha = /[A-Za-z]$/.test(curr);
        const nextStartsAlpha = /^[A-Za-z]/.test(next);
        // If both sides are alpha and curr is a single char, likely a split word
        const likelySplit = currEndsAlpha && nextStartsAlpha && curr.trim().length <= 2;
        pageText += likelySplit ? "" : " ";
      }
    }
    pageTexts.push(pageText);
  }

  return pageTexts.join("\n");
}

/* =========================================================
   POST-PROCESS: Fix common pdfjs word-split artifacts
   "N AIROBI" → "NAIROBI", "SENIOR   PRINCIPAL" → "SENIOR PRINCIPAL"
========================================================= */
function fixSplitWords(text: string): string {
  return text
    // Collapse multiple spaces to single
    .replace(/[ \t]{2,}/g, " ")
    // Fix known split city names in court headers
    .replace(/\bN AIROBI\b/gi, "NAIROBI")
    .replace(/\bMOMB ASA\b/gi, "MOMBASA")
    .replace(/\bKISU MU\b/gi, "KISUMU")
    .replace(/\bNAK URU\b/gi, "NAKURU")
    .replace(/\bELDOR ET\b/gi, "ELDORET")
    // Fix split "SUCCESSION" which appeared as "SUCCESSION CAUSE" artifact
    .replace(/IN\s+SUCCESSION\s+CAUSE\b/gi, "IN SUCCESSION")
    // Normalize line endings
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

export class PDFParserService {

  static async parsePDF(pdfBuffer: Buffer): Promise<ProbateRecord[]> {
    try {
      console.log("📄 Starting PDF extraction...");
      console.log("🔍 Buffer size:", pdfBuffer?.length ?? "NO BUFFER");

      const rawText = await extractTextWithPdfjs(pdfBuffer);
      const text = fixSplitWords(rawText);

      const datePublished = this.extractDatePublished(text);
      console.log("📅 Date published:", datePublished);

      const records = this.extractAllRecords(text, datePublished);
      console.log(`✅ Extraction complete: ${records.length} records found`);
      return records;

    } catch (error) {
      const appError = toAppError(error);
      console.error("PDF parsing error:", appError.message);
      throw new AppError(`Failed to parse PDF: ${appError.message}`);
    }
  }

  private static extractAllRecords(
    text: string,
    datePublished: string
  ): ProbateRecord[] {
    const records: ProbateRecord[] = [];
    const seen = new Set<string>();
    let currentCourtStation = "";

    const CAUSE_REGEX = /Cause\s+No\.?\s*(E?\d+)\s+of\s+(\d{4})/gi;
    let m: RegExpExecArray | null;
    CAUSE_REGEX.lastIndex = 0;

    while ((m = CAUSE_REGEX.exec(text)) !== null) {
      const numPart = m[1].toUpperCase();
      const year = m[2];
      const causeNumber = `${numPart}/${year}`;

      if (seen.has(causeNumber)) continue;
      seen.add(causeNumber);

      // Look back up to 3000 chars for the most recent court header
      const beforeText = text.substring(Math.max(0, m.index - 3000), m.index);
      const court = this.extractCourtStation(beforeText);
      if (court) currentCourtStation = court;

      // Look ahead 600 chars for estate name
      const afterText = text.substring(m.index, Math.min(text.length, m.index + 600));
      const deceasedName = this.extractDeceasedName(afterText);

      if (deceasedName && currentCourtStation) {
        records.push({
          courtStation: currentCourtStation,
          causeNumber,
          deceasedName,
          datePublished,
          extractedAt: new Date(),
        });
      }
    }

    console.log(`📊 Raw matches: ${records.length}`);
    return this.removeDuplicates(records);
  }

  /* -------------------------------------------------------
     EXTRACT COURT STATION
     
     Strips "IN THE" prefix and "OF KENYA" from High Court.
     Takes the LAST match in beforeText (most recent header).
     
     IN THE HIGH COURT OF KENYA AT NAIROBI         → HIGH COURT AT NAIROBI
     IN THE HIGH COURT OF KENYA AT NAIROBI         → HIGH COURT AT NAIROBI
       IN SUCCESSION                               (appended for succession matters)
     IN THE CHIEF MAGISTRATE'S COURT AT KIAMBU     → CHIEF MAGISTRATE'S COURT AT KIAMBU
     IN THE RESIDENT MAGISTRATE'S COURT AT KWALE   → RESIDENT MAGISTRATE'S COURT AT KWALE
  ------------------------------------------------------- */
  private static extractCourtStation(text: string): string | null {
    const courtPatterns: Array<{
      regex: RegExp;
      format: (m: RegExpMatchArray) => string;
    }> = [
      {
        // High Court — "IN THE HIGH COURT OF KENYA AT NAIROBI [IN SUCCESSION]"
        regex: /IN\s+THE\s+HIGH\s+COURT\s+OF\s+KENYA\s+AT\s+([A-Z][A-Za-z]+)(?:\s+IN\s+SUCCESSION)?/i,
        format: (m) => `HIGH COURT AT ${m[1].toUpperCase()}`,
      },
      {
        // Chief Magistrate
        regex: /IN\s+THE\s+(CHIEF\s+MAGISTRATE.?S\s+COURT)\s+AT\s+([A-Z][A-Za-z]+)/i,
        format: (m) => `${m[1].toUpperCase()} AT ${m[2].toUpperCase()}`,
      },
      {
        // Senior Principal Magistrate (before Principal to avoid partial match)
        regex: /IN\s+THE\s+(SENIOR\s+PRINCIPAL\s+MAGISTRATE.?S\s+COURT)\s+AT\s+([A-Z][A-Za-z]+)/i,
        format: (m) => `${m[1].toUpperCase()} AT ${m[2].toUpperCase()}`,
      },
      {
        // Senior Resident Magistrate
        regex: /IN\s+THE\s+(SENIOR\s+RESIDENT\s+MAGISTRATE.?S\s+COURT)\s+AT\s+([A-Z][A-Za-z]+)/i,
        format: (m) => `${m[1].toUpperCase()} AT ${m[2].toUpperCase()}`,
      },
      {
        // Principal Magistrate
        regex: /IN\s+THE\s+(PRINCIPAL\s+MAGISTRATE.?S\s+COURT)\s+AT\s+([A-Z][A-Za-z]+)/i,
        format: (m) => `${m[1].toUpperCase()} AT ${m[2].toUpperCase()}`,
      },
      {
        // Resident Magistrate
        regex: /IN\s+THE\s+(RESIDENT\s+MAGISTRATE.?S\s+COURT)\s+AT\s+([A-Z][A-Za-z]+)/i,
        format: (m) => `${m[1].toUpperCase()} AT ${m[2].toUpperCase()}`,
      },
      {
        // Kadhi's Court
        regex: /IN\s+THE\s+(KADHI.?S\s+COURT)\s+AT\s+([A-Z][A-Za-z]+)/i,
        format: (m) => `${m[1].toUpperCase()} AT ${m[2].toUpperCase()}`,
      },
    ];

    for (const { regex, format } of courtPatterns) {
      const allMatches = [...text.matchAll(new RegExp(regex.source, "gi"))];
      if (allMatches.length > 0) {
        return format(allMatches[allMatches.length - 1]);
      }
    }

    return null;
  }

  /* -------------------------------------------------------
     EXTRACT DECEASED NAME
     Gazette body: "...to the estate of Kihurani Gakuu, late of..."
  ------------------------------------------------------- */
  private static extractDeceasedName(context: string): string {
    const patterns = [
      /(?:the\s+)?estate\s+of\s+([A-Z][A-Za-z\s\-'\.]+?),\s*late\s+of/i,
      /(?:the\s+)?estate\s+of\s+([A-Z][A-Za-z\s\-'\.]+?)\s+who\s+died/i,
      /(?:the\s+)?estate\s+of\s+([A-Z][A-Za-z\s\-'\.]+?)\s+alias\s/i,
      /(?:the\s+)?estate\s+of\s+([A-Z][A-Za-z\s\-'\.]{4,60}?),/i,
    ];

    for (const pattern of patterns) {
      const match = context.match(pattern);
      if (match?.[1]) {
        const name = this.cleanDeceasedName(match[1]);
        if (name.length >= 3) return name;
      }
    }

    return "";
  }

  private static extractDatePublished(text: string): string {
    let match = text.match(
      /NAIROBI,\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+,?\s+\d{4})/i
    );
    if (match) return normalizeDate(match[1]);

    match = text.match(
      /Dated\s+the\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+,?\s+\d{4})/i
    );
    if (match) return normalizeDate(match[1]);

    console.warn("⚠️ Publication date not found, using today");
    return new Date().toISOString().split("T")[0];
  }

  private static cleanDeceasedName(name: string): string {
    return name
      .replace(/,?\s*late\s+of.*/i, "")
      .replace(/\s+who\s+died.*/i, "")
      .replace(/\s+alias\s+.*/i, "")
      .replace(/\([^)]*\)/g, "")
      .replace(/\s+/g, " ")
      .replace(/^[\s,]+|[\s,]+$/g, "")
      .trim();
  }

  private static removeDuplicates(records: ProbateRecord[]): ProbateRecord[] {
    const seen = new Map<string, ProbateRecord>();
    for (const record of records) {
      const key = `${record.causeNumber}|${record.courtStation}`;
      if (!seen.has(key)) seen.set(key, record);
    }
    return Array.from(seen.values());
  }
}