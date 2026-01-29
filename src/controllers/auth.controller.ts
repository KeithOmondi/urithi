import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
import { User } from "../models/User";
import {
  signAccessToken,
  signRefreshToken,
  TokenPayload,
  verifyRefreshToken,
} from "../utils/jwt";

/**
 * Helper to set HttpOnly cookies
 */
const setTokenCookies = (res: Response, user: any) => {
  const payload: TokenPayload = { id: user._id.toString(), role: user.role };
  
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production", // must be true in prod
  sameSite: process.env.NODE_ENV === "production" ? "none" as const : "lax" as const,
  path: "/", // cookie available to all routes
};


  // Set Access Token (short lived)
  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 minutes
  });

  // Set Refresh Token (long lived)
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return { accessToken, refreshToken };
};

/* =====================================
    LOGIN (Refactored without next())
===================================== */
/* =====================================
    LOGIN
===================================== */
export const login = async (req: Request, res: Response) => {
  console.log("--- Login Attempt Start ---");
  console.log("PJ Number received:", req.body.pjNumber);

  try {
    const { pjNumber, password } = req.body;

    if (!pjNumber || !password) {
      return res.status(400).json({
        status: "fail",
        message: "PJ Number and password are required",
      });
    }

    const user = await User.findOne({ pjNumber }).select("+password");
    
    // Check Existence and Password
    if (!user || !(await user.comparePassword(password))) {
      console.warn(`Auth Failed for PJ: ${pjNumber} - Reason: User not found or password mismatch`);
      return res.status(401).json({
        status: "fail",
        message: "Invalid credentials", // THIS IS WHAT THE FRONTEND NEEDS
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        status: "fail",
        message: "Account is deactivated",
      });
    }

    setTokenCookies(res, user);

    console.log(`Auth Success: ${user.firstName} logged in`);
    return res.status(200).json({
      status: "success",
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      },
    });
    
  } catch (error: any) {
    console.error("Critical Login Error:", error);
    return res.status(500).json({
      status: "error",
      message: "An internal server error occurred",
    });
  }
};



/* =====================================
   REFRESH TOKEN
===================================== */
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 1. Get token from cookies
    const token = req.cookies.refreshToken;

    if (!token)
      return next(new AppError("Session expired, please login again", 401));

    // 2. Verify
    const payload = verifyRefreshToken(token);

    // 3. User check
    const user = await User.findById(payload.id);
    if (!user || !user.isActive)
      return next(new AppError("User no longer exists", 401));

    // 4. Set NEW cookies (Rotation)
    setTokenCookies(res, user);

    // 5. Send back the user data so Redux can hydrate the state
    res.status(200).json({
      status: "success",
      message: "Tokens refreshed",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(new AppError("Invalid refresh token", 401));
  }
};

/* =====================================
   LOGOUT
===================================== */
export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // Clear cookies by setting maxAge to 0
    res.cookie("accessToken", "", { maxAge: 0 });
    res.cookie("refreshToken", "", { maxAge: 0 });

    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};
