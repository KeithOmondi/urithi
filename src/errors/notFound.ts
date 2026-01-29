import { Request, Response, NextFunction } from "express";
import { AppError } from "./AppError";

export const notFound = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};
