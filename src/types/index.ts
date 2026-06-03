export interface ProbateRecord {
  courtStation: string;
  causeNumber: string;
  deceasedName: string;
  datePublished: string;
  extractedAt: Date;
}

export interface ExtractionResponse {
  success: boolean;
  data?: ProbateRecord[];
  totalRecords: number;
  fileUrl?: string;
  error?: string;
  processingTimeMs?: number;
}

export interface ExtractionJob {
  _id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  records: ProbateRecord[];
  totalRecords: number;
  processingTimeMs?: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}