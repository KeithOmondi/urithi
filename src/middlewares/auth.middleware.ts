import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { verifyAccessToken, TokenPayload } from "../utils/jwt";

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

/* =====================================
   AUTHENTICATION: PROTECT ROUTES
===================================== */
export const protect = (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    let token: string | undefined;

    // 1. Check for token in Cookies (Primary) or Authorization Header (Fallback/Postman)
    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    } else if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return next(
        new AppError(
          "You are not logged in. Please log in to get access.",
          401,
        ),
      );
    }

    // 2. Verify token using our utility
    const payload = verifyAccessToken(token);

    // 3. Attach user to request
    req.user = {
      id: payload.id,
      role: payload.role,
    };

    next();
  } catch (error) {
    // If token is expired, the interceptor on the frontend will catch this 401
    next(new AppError("Invalid or expired token", 401));
  }
};

/* =====================================
   AUTHORIZATION: RESTRICT BY ROLE
===================================== */
export const restrictTo = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return next(
        new AppError("You do not have permission to perform this action", 403),
      );
    }
    next();
  };
};
