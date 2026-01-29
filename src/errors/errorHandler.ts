import { Request, Response, NextFunction } from "express";
import { AppError } from "./AppError";
import { env } from "../config/env";

export const errorHandler = (
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = 500;
  let message = "Internal server error";

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  // Log full error in development
  if (env.NODE_ENV === "development") {
    console.error("🔥 ERROR:", err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(env.NODE_ENV === "development" && {
      stack: err.stack
    })
  });
};
