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
  "BREVO_API_KEY",
  "MAIL_FROM_NAME",
  "MAIL_FROM_EMAIL",
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

  MONGO_URI_TARGET: process.env.MONGO_URI_TARGET,
  DB_NAME_TARGET: process.env.DB_NAME_TARGET ?? process.env.DB_NAME,

  JWT_SECRET: process.env.JWT_SECRET as string,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET as string,

  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN as JwtDuration,
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN as JwtDuration,

  NODE_ENV: process.env.NODE_ENV || "development",
  APP_VERSION: process.env.APP_VERSION || "unknown",
  COMMIT_HASH: process.env.COMMIT_HASH || "unknown",

  BREVO_API_KEY: process.env.BREVO_API_KEY as string,
  MAIL_FROM_NAME: process.env.MAIL_FROM_NAME as string,
  MAIL_FROM_EMAIL: process.env.MAIL_FROM_EMAIL as string,

  FRONTEND_URL: process.env.FRONTEND_URL,
};

