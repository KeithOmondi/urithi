import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { env } from "./env";

// Configure Cloudinary
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

// Use memory storage instead of cloudinary storage
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});


export const uploadToCloudinary = async (file: Express.Multer.File) => {
  try {
    return await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: "judiciary_rejections",
          resource_type: "auto",
          public_id: `reject_${Date.now()}`,
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
