import { Request, Response, NextFunction, RequestHandler } from "express";

export const asyncHandler =
  <T = any>(fn: RequestHandler<any, any, T>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
