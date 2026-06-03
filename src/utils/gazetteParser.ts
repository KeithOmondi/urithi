// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
pdfjsLib.GlobalWorkerOptions.workerSrc = "";

// Case-insensitive — gazette uses small caps: "Cause No." not "CAUSE NO."
// Handles: "Cause No. E497 of 2024", "CAUSE NO. E497 OF 2024", "Cause No. 674 of 2025"
const CAUSE_NO_REGEX = /Cause\s+No\.?\s*(E?\d+)\s+of\s+(\d{4})/gi;

export interface ParsedCauseNo {
  raw: string;
  normalized: string;
}

async function extractTextFromPdf(fileBuffer: Buffer): Promise<string> {
  if (!fileBuffer || fileBuffer.length === 0) {
    throw new Error(
      "File buffer is empty. Scanner route must use memory storage."
    );
  }

  const uint8Array = new Uint8Array(fileBuffer);
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
    const pageText = content.items
      .map((item: { str?: string }) => item.str ?? "")
      .join(" ");
    pageTexts.push(pageText);
  }

  return pageTexts.join("\n");
}

export async function extractCauseNosFromPdf(
  fileBuffer: Buffer
): Promise<ParsedCauseNo[]> {
  const text = await extractTextFromPdf(fileBuffer);

  const found: ParsedCauseNo[] = [];
  const seen = new Set<string>();

  CAUSE_NO_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;

  while ((match = CAUSE_NO_REGEX.exec(text)) !== null) {
    const number = match[1].trim().toUpperCase(); // E497
    const year = match[2].trim();                 // 2024
    const raw = `${number} OF ${year}`;           // E497 OF 2024
    const normalized = `CAUSE NO. ${raw}`;        // CAUSE NO. E497 OF 2024

    if (!seen.has(normalized)) {
      seen.add(normalized);
      found.push({ raw, normalized });
    }
  }

  return found;
}