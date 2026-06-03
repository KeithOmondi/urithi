import mongoose, { Schema, Document } from 'mongoose';

export interface IExtractedRecord {
  courtStation: string;
  causeNumber: string;
  deceasedName: string;
  datePublished: string;
  extractedAt: Date;
}

export interface IExtractionJob extends Document {
  fileUrl: string;
  fileName: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  records: IExtractedRecord[];
  totalRecords: number;
  processingTimeMs?: number;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

const ExtractedRecordSchema = new Schema<IExtractedRecord>({
  courtStation: { type: String, required: true },
  causeNumber: { type: String, required: true, index: true },
  deceasedName: { type: String, required: true, index: true },
  datePublished: { type: String, required: true },
  extractedAt: { type: Date, default: Date.now }
});

const ExtractionJobSchema = new Schema<IExtractionJob>({
  fileUrl: { type: String, required: true },
  fileName: { type: String, required: true },
  fileSize: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  records: [ExtractedRecordSchema],
  totalRecords: { type: Number, default: 0 },
  processingTimeMs: { type: Number },
  error: { type: String },
  createdAt: { type: Date, default: Date.now },
  completedAt: { type: Date }
});

// Compound index for faster searching
ExtractionJobSchema.index({ createdAt: -1 });
ExtractionJobSchema.index({ 'records.causeNumber': 1 });
ExtractionJobSchema.index({ 'records.deceasedName': 1 });
ExtractionJobSchema.index({ 'records.courtStation': 1 });

export const ExtractionJob = mongoose.model<IExtractionJob>('ExtractionJob', ExtractionJobSchema);