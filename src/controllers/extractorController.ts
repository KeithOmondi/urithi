import { Request, Response } from 'express';
import fs from 'fs';  
import { uploadToCloudinary } from '../config/cloudinary';
import { PDFParserService } from '../services/pdfParserService';
import { ExtractionJob } from '../models/extractorModel';
import { ExtractionResponse } from '../types';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode = 500) {
    super(message);

    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Helper to normalize any caught value into an AppError
const toAppError = (error: unknown): AppError => {
  if (error instanceof AppError) return error;
  if (error instanceof Error) return new AppError(error.message);
  // Handle plain objects like Cloudinary's error response
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return new AppError(String((error as Record<string, unknown>).message));
  }
  return new AppError('An unexpected error occurred');
};

export class ExtractorController {

  static async uploadAndExtract(req: Request, res: Response) {
  const startTime = Date.now();

  console.log('🔍 req.file exists:', !!req.file);
  console.log('🔍 req.file.buffer exists:', !!req.file?.buffer);
  console.log('🔍 req.file.buffer length:', req.file?.buffer?.length ?? 'NO BUFFER');
  console.log('🔍 req.file.path:', req.file?.path ?? 'NO PATH');

  try {
    if (!req.file) {
      throw new AppError('No PDF file uploaded', 400);
    }

    console.log(`📄 Processing: ${req.file.originalname} (${req.file.size} bytes)`);

    // Read buffer from disk if memory storage wasn't used
    let fileBuffer = req.file.buffer;
    if (!fileBuffer && req.file.path) {
      console.log('⚠️ No buffer found, reading from disk path...');
      fileBuffer = fs.readFileSync(req.file.path);
      console.log(`📂 Read ${fileBuffer.length} bytes from disk`);
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new AppError('File buffer is empty', 400);
    }

    // Upload to Cloudinary
    console.log('📤 Uploading to Cloudinary...');
    const cloudinaryResult = await uploadToCloudinary({
      ...req.file,
      buffer: fileBuffer
    }) as any;

    // Parse PDF and extract records
    console.log('🔍 Extracting records from PDF...');
    const records = await PDFParserService.parsePDF(fileBuffer);

    // Clean up disk file after processing
    if (req.file.path) {
      fs.unlinkSync(req.file.path);
      console.log('🗑️ Cleaned up temp file');
    }

    // Save to database
    const extractionJob = new ExtractionJob({
      fileUrl: cloudinaryResult.secure_url,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      status: 'completed',
      records: records,
      totalRecords: records.length,
      processingTimeMs: Date.now() - startTime,
      completedAt: new Date()
    });

    await extractionJob.save();

    const response: ExtractionResponse = {
      success: true,
      data: records,
      totalRecords: records.length,
      fileUrl: cloudinaryResult.secure_url,
      processingTimeMs: Date.now() - startTime
    };

    console.log(`✅ Success: ${records.length} records extracted in ${response.processingTimeMs}ms`);
    res.json(response);

  } catch (error) {
    const appError = toAppError(error);
    console.error('❌ Extraction error:', appError.message);

    // Clean up disk file on error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log('🗑️ Cleaned up temp file after error');
    }

    if (req.file) {
      const failedJob = new ExtractionJob({
        fileUrl: '',
        fileName: req.file.originalname,
        fileSize: req.file.size,
        status: 'failed',
        error: appError.message,
        records: [],
        totalRecords: 0
      });
      await failedJob.save();
    }

    res.status(appError.statusCode).json({
      success: false,
      error: appError.message
    });
  }
}

  static async getAllJobs(req: Request, res: Response) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const jobs = await ExtractionJob.find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-records'); // Don't return all records in list view

      const total = await ExtractionJob.countDocuments();

      res.json({
        success: true,
        data: jobs,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      const appError = toAppError(error);
      res.status(appError.statusCode).json({
        success: false,
        error: appError.message
      });
    }
  }

  static async getJobById(req: Request, res: Response) {
    try {
      const job = await ExtractionJob.findById(req.params.id);

      if (!job) {
        throw new AppError('Extraction job not found', 404);
      }

      res.json({
        success: true,
        data: job
      });
    } catch (error) {
      const appError = toAppError(error);
      res.status(appError.statusCode).json({
        success: false,
        error: appError.message
      });
    }
  }

  static async searchRecords(req: Request, res: Response) {
    try {
      const { jobId } = req.params;
      const { query, field = 'deceasedName' } = req.query;

      const job = await ExtractionJob.findById(jobId);

      if (!job) {
        throw new AppError('Extraction job not found', 404);
      }

      const filteredRecords = job.records.filter((record: any) => {
        const fieldValue = record[field as string] || '';
        return fieldValue.toLowerCase().includes((query as string).toLowerCase());
      });

      res.json({
        success: true,
        data: filteredRecords,
        total: filteredRecords.length,
        totalInJob: job.records.length
      });
    } catch (error) {
      const appError = toAppError(error);
      res.status(appError.statusCode).json({
        success: false,
        error: appError.message
      });
    }
  }

  static async exportAsCSV(req: Request, res: Response) {
    try {
      const job = await ExtractionJob.findById(req.params.id);

      if (!job || !job.records.length) {
        throw new AppError('No records found to export', 404);
      }

      // Create CSV header
      const headers = ['Court Station', 'Cause Number', 'Deceased Name', 'Date Published'];
      const csvRows = [headers];

      // Add data rows
      for (const record of job.records) {
        csvRows.push([
          `"${record.courtStation.replace(/"/g, '""')}"`,
          record.causeNumber,
          `"${record.deceasedName.replace(/"/g, '""')}"`,
          record.datePublished
        ]);
      }

      const csvContent = csvRows.map(row => row.join(',')).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=probate_records_${job._id}.csv`);
      res.send(csvContent);

    } catch (error) {
      const appError = toAppError(error);
      res.status(appError.statusCode).json({
        success: false,
        error: appError.message
      });
    }
  }

  static async getStats(req: Request, res: Response) {
    try {
      const totalJobs = await ExtractionJob.countDocuments();
      const successfulJobs = await ExtractionJob.countDocuments({ status: 'completed' });
      const totalRecords = await ExtractionJob.aggregate([
        { $group: { _id: null, total: { $sum: '$totalRecords' } } }
      ]);

      res.json({
        success: true,
        data: {
          totalJobs,
          successfulJobs,
          failedJobs: totalJobs - successfulJobs,
          totalRecords: totalRecords[0]?.total || 0
        }
      });
    } catch (error) {
      const appError = toAppError(error);
      res.status(appError.statusCode).json({
        success: false,
        error: appError.message
      });
    }
  }
}