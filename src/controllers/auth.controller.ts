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
   LOGIN
===================================== */
export const login = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { pjNumber, password } = req.body;
    if (!pjNumber || !password)
      return next(new AppError("PJ Number and password are required", 400));

    const user = await User.findOne({ pjNumber }).select("+password");
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError("Invalid credentials", 401));
    }

    if (!user.isActive)
      return next(new AppError("Account is deactivated", 403));

    // Set Cookies
    setTokenCookies(res, user);

    res.status(200).json({
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
  } catch (error) {
    next(error);
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
