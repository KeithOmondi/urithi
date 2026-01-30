import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { AppError } from "../errors/AppError";
import { User } from "../models/User";
import { sendOtp } from "../utils/sendOtp";
import {
  signAccessToken,
  signRefreshToken,
  TokenPayload,
  verifyRefreshToken,
} from "../utils/jwt";

/* =========================================================
   COOKIE HELPER
========================================================= */
const setTokenCookies = (res: Response, user: any) => {
  const payload: TokenPayload = { id: user._id.toString(), role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite:
      process.env.NODE_ENV === "production"
        ? ("none" as const)
        : ("lax" as const),
    path: "/",
  };

  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  });
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

/* =========================================================
   LOGIN — SEND OTP
========================================================= */
export const login = async (req: Request, res: Response) => {
  try {
    const { pjNumber } = req.body;
    if (!pjNumber)
      return res
        .status(400)
        .json({ status: "fail", message: "PJ Number required" });

    const user = await User.findOne({ pjNumber: pjNumber.toLowerCase() });
    if (!user || !user.isActive || !user.email)
      return res
        .status(200)
        .json({ status: "success", message: "OTP sent if account exists" });

    await sendOtp(user);

    return res
      .status(200)
      .json({ status: "success", message: "OTP sent if account exists" });
  } catch (err) {
    console.error("Login OTP Error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

/* =========================================================
   VERIFY OTP
========================================================= */
export const verifyOtp = async (req: Request, res: Response) => {
  try {
    const { pjNumber, otp } = req.body;
    if (!pjNumber || !otp)
      return res
        .status(400)
        .json({ status: "fail", message: "PJ Number and OTP required" });

    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    const user = await User.findOne({
      pjNumber: pjNumber.toLowerCase(),
      otp: hashedOtp,
      otpExpires: { $gt: new Date() },
    });

    if (!user)
      return res
        .status(400)
        .json({ status: "fail", message: "Invalid or expired OTP" });

    // Clear OTP
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save({ validateBeforeSave: false });

    setTokenCookies(res, user);

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
  } catch (err) {
    console.error("OTP Verification Error:", err);
    return res
      .status(500)
      .json({ status: "error", message: "Internal server error" });
  }
};

/* =========================================================
   REFRESH TOKEN
========================================================= */
export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token)
      return next(new AppError("Session expired, please login again", 401));

    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.id);
    if (!user || !user.isActive)
      return next(new AppError("User no longer exists", 401));

    setTokenCookies(res, user);

    return res.status(200).json({
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
  } catch {
    next(new AppError("Invalid refresh token", 401));
  }
};

/* =========================================================
   LOGOUT
========================================================= */
export const logout = async (_req: Request, res: Response) => {
  res.cookie("accessToken", "", { maxAge: 0 });
  res.cookie("refreshToken", "", { maxAge: 0 });
  res
    .status(200)
    .json({ status: "success", message: "Logged out successfully" });
};
