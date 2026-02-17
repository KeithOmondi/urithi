import dotenv from "dotenv";
dotenv.config();

/* =====================================
   TYPES
===================================== */
type JwtDuration = `${number}${"s" | "m" | "h" | "d"}`;

/* =====================================
   REQUIRED ENV VARS
===================================== */
const required = [
  "PORT",
  "MONGO_URI",
  "DB_NAME",

  "JWT_SECRET",
  "JWT_REFRESH_SECRET",
  "JWT_EXPIRES_IN",
  "JWT_REFRESH_EXPIRES_IN",

  // ✅ BREVO TRANSACTIONAL API
  "BREVO_API_KEY",

  // ✅ EMAIL SENDER
  "MAIL_FROM_NAME",
  "MAIL_FROM_EMAIL",

  // ✅ APP METADATA
  "APP_VERSION",
  "COMMIT_HASH",
] as const;

required.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`❌ Missing environment variable: ${key}`);
  }
});

/* =====================================
   ENV EXPORT
===================================== */
export const env = {
  PORT: Number(process.env.PORT),

  MONGO_URI: process.env.MONGO_URI as string,
  DB_NAME: process.env.DB_NAME as string,

  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,

  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN as JwtDuration,
  JWT_REFRESH_EXPIRES_IN:
    process.env.JWT_REFRESH_EXPIRES_IN as JwtDuration,

  NODE_ENV: process.env.NODE_ENV || "production",

  // ✅ BREVO TRANSACTIONAL API
  BREVO_API_KEY: process.env.BREVO_API_KEY as string,

  // ✅ EMAIL
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME as string,
  MAIL_FROM_EMAIL: process.env.MAIL_FROM_EMAIL as string,
  DEFAULT_CC_EMAIL: process.env.DEFAULT_CC_EMAIL as string,

  //CLOUDINARY
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME as string,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY as string,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET as string,

  // ✅ APP INFO
  APP_VERSION: process.env.APP_VERSION || "dev",
  COMMIT_HASH: process.env.COMMIT_HASH || "local",

  FRONTEND_URL: process.env.FRONTEND_URL,
};
