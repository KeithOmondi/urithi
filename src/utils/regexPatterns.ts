export const patterns = {
  // Cause Number - Matches both formats:
  // E497 of 2024, E497/2024, E35 OF 2024
  causeNumber: /CAUSE\s+NO\.?\s*([A-Z]?\d+)\s+(?:OF|of|\/)\s*(\d{4})/gi,
  causeNumberAlt: /CAUSE\s+NO\.?\s*([A-Z]?\d+(?:\s+OF\s+|\s+of\s+|\/)\s*\d{4})/gi,
  
  // Court Station - matches court headers
  courtStation: /IN\s+THE\s+([A-Z\s]+?)\s+COURT\s+OF\s+KENYA\s+AT\s+([A-Z][a-z]+)/gi,
  courtStationSimple: /(?:HIGH COURT|CHIEF MAGISTRATE'S COURT|KADHI'S COURT)\s+OF\s+KENYA\s+AT\s+([A-Z][a-z]+)/i,
  
  // Deceased name - simplified
  deceasedName: /estate\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s+alias\s+[^,]+)?)(?=,|\s+late\s+of|\s+who\s+died|\s*$)/i,
  deceasedNameSimple: /to\s+the\s+estate\s+of\s+([^,]+?)(?:\s*,\s*late\s+of|\s+who\s+died|\s*$)/i,
  
  // Date published (from header)
  datePublished: /NAIROBI,\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+,\s+\d{4})/i,
  datePublishedAlt: /Dated\s+the\s+(\d{1,2}(?:st|nd|rd|th)?\s+[A-Z][a-z]+,\s+\d{4})/i,
  
  // Section separator (where records start)
  sectionStart: /TAKE NOTICE that applications having been made in this court in:/i
};

// Helper functions
export const cleanText = (text: string): string => {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[^\x20-\x7E\n]/g, ' ')
    .trim();
};

export const normalizeDate = (dateStr: string): string => {
  if (!dateStr) return '';
  
  // Remove ordinal indicators (st, nd, rd, th)
  const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/g, '$1');
  
  try {
    const date = new Date(cleaned);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    }
  } catch (e) {
    // Return original if parsing fails
  }
  
  return cleaned;
};

export const formatCauseNumber = (prefix: string, year: string): string => {
  // Format as E001/2025 style
  const num = prefix.padStart(3, '0');
  return `${num}/${year}`;
};