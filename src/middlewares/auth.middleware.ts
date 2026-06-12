// middlewares/auth.middleware.ts
import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { User } from "../models/User";
import { AppError } from "../errors/AppError";

export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token;
    
    // Get token from cookie or Authorization header
    if (req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    
    if (!token) {
      return next(new AppError("You are not logged in", 401));
    }
    
    // Verify token
    const decoded = verifyAccessToken(token);
    
    // Check if user still exists
    const user = await User.findById(decoded.id).select("+passwordChangedAt");
    if (!user || !user.isActive) {
      return next(new AppError("User no longer exists", 401));
    }
    
    // Check if password was changed after token was issued
    if (user.changedPasswordAfter && user.changedPasswordAfter(decoded.iat || 0)) {
      return next(new AppError("Password changed recently. Please login again", 401));
    }
    
    // Grant access
    (req as any).user = user;
    next();
  } catch (error) {
    return next(new AppError("Invalid or expired token", 401));
  }
};

// Role restriction middleware
export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !roles.includes(user.role)) {
      return next(new AppError("You don't have permission to perform this action", 403));
    }
    next();
  };
};