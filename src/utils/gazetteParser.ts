// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");
pdfjsLib.GlobalWorkerOptions.workerSrc = "";

// More flexible patterns - now case-insensitive and handles multiple formats
const CAUSE_NO_PATTERNS = [
  // Format: "Cause No. E497 of 2024" or "CAUSE NO. E497 OF 2024"
  /Cause\s+No\.?\s*(E?\d+)\s+of\s+(\d{4})/gi,
  
  // Format: "Cause No. E497/2024"
  /Cause\s+No\.?\s*(E?\d+)\s*\/\s*(\d{4})/gi,
  
  // Format: "E497/2024" (without "Cause No.")
  /(E?\d+)\s*\/\s*(\d{4})/gi,
  
  // Format: "E497 OF 2024" (without "Cause No.")
  /(E?\d+)\s+OF\s+(\d{4})/gi,
  
  // Format: "E497-2024"
  /(E?\d+)\s*-\s*(\d{4})/gi,
  
  // Format: "Cause No: E497 of 2024"
  /Cause\s+No[.:]\s*(E?\d+)\s+of\s+(\d{4})/gi,
];

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
  
  // Log for debugging
  console.log('Extracted text length:', text.length);
  console.log('First 500 chars:', text.substring(0, 500));

  const found: ParsedCauseNo[] = [];
  const seen = new Set<string>();

  // Try each pattern
  for (const pattern of CAUSE_NO_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      const number = match[1].trim().toUpperCase();
      const year = match[2].trim();
      
      // Format as "E497/2024" for consistency
      const normalized = `${number}/${year}`;
      const raw = `${number} OF ${year}`;

      if (!seen.has(normalized)) {
        seen.add(normalized);
        found.push({ raw, normalized });
      }
    }
  }

  console.log('Found cause numbers:', found.length);
  console.log('Sample:', found.slice(0, 3));

  return found;
}