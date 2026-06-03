import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { env } from "./env";

// Configure Cloudinary
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

// Memory storage — keeps buffer available for both
// Cloudinary upload and PDF parsing
const storage = multer.memoryStorage();

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype === "application/pdf") {
    cb(null, true);
  } else {
    cb(new Error("PDF files only!"));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB — your gazette is 1.5MB, 5MB was too low
});

export const uploadToCloudinary = async (file: Express.Multer.File) => {
  try {
    return await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "judiciary_rejections",
          resource_type: "raw", // use "raw" for PDFs — "auto" can misidentify them
          public_id: `gazette_${Date.now()}`,
          format: "pdf",
        },
        (error, result) => {
          if (error) {
            console.error("❌ Cloudinary upload error:", error);
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
      stream.end(file.buffer);
    });
  } catch (error) {
    console.error("Unexpected upload error:", error);
    throw error;
  }
};

export default cloudinary;