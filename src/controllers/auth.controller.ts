import { Request, Response, NextFunction } from "express";
//import bcrypt from "bcryptjs";
import crypto from "crypto";
import { AppError } from "../errors/AppError";
import { User, IUser } from "../models/User";
import {
  signAccessToken,
  signRefreshToken,
  TokenPayload,
  verifyRefreshToken,
} from "../utils/jwt";
import { emailTemplates } from "../utils/emailTemplates";
import { sendMail, sendEmailToUser } from "../utils/sendMail";
import { sendPasswordResetToken } from "../utils/sendOtp";

/* =========================================================
   TYPES
========================================================= */
interface LoginNotificationData {
  userName: string;
  email: string;
  loginTime: Date;
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  browser?: string;
  os?: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    coordinates?: string;
  };
}

/* =========================================================
   HELPER FUNCTIONS
========================================================= */
const getDeviceInfo = (userAgent: string) => {
  const ua = userAgent.toLowerCase();
  
  let deviceType = "Unknown";
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    deviceType = "Tablet";
  } else if (/(mobile|iphone|ipod|android|blackberry|windows phone)/i.test(ua)) {
    deviceType = "Mobile";
  } else {
    deviceType = "Desktop";
  }
  
  let browser = "Unknown";
  if (ua.includes("chrome")) browser = "Chrome";
  else if (ua.includes("firefox")) browser = "Firefox";
  else if (ua.includes("safari")) browser = "Safari";
  else if (ua.includes("edge")) browser = "Edge";
  else if (ua.includes("opera")) browser = "Opera";
  
  let os = "Unknown";
  if (ua.includes("windows")) os = "Windows";
  else if (ua.includes("mac")) os = "macOS";
  else if (ua.includes("linux")) os = "Linux";
  else if (ua.includes("android")) os = "Android";
  else if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad")) os = "iOS";
  
  return { deviceType, browser, os };
};

const getLocationFromIP = async (ip: string) => {
  // For now, return basic location info
  // You can integrate with IP geolocation API like ipapi.co, ip-api.com, etc.
  // Example: const response = await fetch(`http://ip-api.com/json/${ip}`);
  // const data = await response.json();
  
  return {
    city: "Nairobi",
    region: "Nairobi County",
    country: "Kenya",
    coordinates: "-1.286389, 36.817223",
  };
};

/* =========================================================
   COOKIE HELPER
========================================================= */
const setTokenCookies = (res: Response, user: IUser) => {
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
    maxAge: 15 * 60 * 1000, // 15 minutes
  });
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

/* =========================================================
   LOGIN WITH EMAIL & PASSWORD
========================================================= */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  console.log("\n🔐 ========== LOGIN ATTEMPT ==========");
  console.log(`📅 Time: ${new Date().toISOString()}`);
  console.log(`📧 Email: ${req.body.email}`);
  console.log(`🌐 IP: ${req.ip}`);
  console.log(`🖥️ User Agent: ${req.headers["user-agent"]}`);
  
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      console.log("❌ Login failed: Missing email or password");
      return res.status(400).json({ 
        status: "fail", 
        message: "Email and password required" 
      });
    }

    console.log("🔍 Looking up user...");
    // Find user with password field
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    
    if (!user || !user.isActive) {
      console.log(`❌ Login failed: User not found or inactive - ${email}`);
      return res.status(401).json({ 
        status: "fail", 
        message: "Invalid email or password" 
      });
    }

    console.log(`✅ User found: ${user.firstName} ${user.lastName} (${user.role})`);
    
    // Check password
    console.log("🔑 Verifying password...");
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      console.log(`❌ Login failed: Invalid password for ${email}`);
      return res.status(401).json({ 
        status: "fail", 
        message: "Invalid email or password" 
      });
    }

    console.log("✅ Password verified successfully");

    // Get device and location info
    console.log("📱 Gathering device info...");
    const userAgent = req.headers["user-agent"] || "Unknown";
    const ipAddress = (req.headers["x-forwarded-for"] as string)?.split(",")[0] || 
                      req.socket.remoteAddress || 
                      "Unknown";
    
    const deviceInfo = getDeviceInfo(userAgent);
    const locationInfo = await getLocationFromIP(ipAddress);

    console.log(`📱 Device: ${deviceInfo.deviceType} | ${deviceInfo.browser} | ${deviceInfo.os}`);
    console.log(`📍 Location: ${locationInfo.city}, ${locationInfo.country}`);
    console.log(`🌐 IP Address: ${ipAddress}`);

    // Update last login
    console.log("🔄 Updating last login timestamp...");
    user.set({ lastLoginAt: new Date() });
    await user.save({ validateBeforeSave: false });
    console.log("✅ Last login updated");

    // Send login notification email (don't await to not block response)
    console.log("📧 Sending login notification email...");
    const notificationData: LoginNotificationData = {
      userName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      loginTime: new Date(),
      ipAddress: ipAddress,
      userAgent: userAgent,
      deviceType: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      os: deviceInfo.os,
      location: locationInfo,
    };

    const emailTemplate = emailTemplates.loginNotification(notificationData);
    sendEmailToUser(user.email, emailTemplate.subject, emailTemplate.html, emailTemplate.text).catch((error: Error) => {
      console.error("❌ Failed to send login notification email:", error.message);
    });
    console.log("📧 Login notification email queued");

    console.log("🍪 Setting token cookies...");
    setTokenCookies(res, user);
    console.log("✅ Cookies set successfully");

    console.log(`🎉 LOGIN SUCCESS: ${user.firstName} ${user.lastName} (${user.role})`);
    console.log("========================================\n");

    return res.status(200).json({
      status: "success",
      message: "Login successful",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          pjNumber: user.pjNumber,
        },
      },
    });
  } catch (err) {
    console.error("❌ ========== LOGIN ERROR ==========");
    console.error("Error type:", err instanceof Error ? err.constructor.name : typeof err);
    console.error("Error message:", err instanceof Error ? err.message : String(err));
    console.error("Stack trace:", err instanceof Error ? err.stack : "No stack trace");
    console.error("==================================\n");
    
    return next(new AppError("Internal server error", 500));
  }
};

/* =========================================================
   REGISTER - Create new user (Admin only)
========================================================= */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, passwordConfirm, firstName, lastName, pjNumber, role } = req.body;

    // Validation
    if (!email || !password || !passwordConfirm || !firstName || !lastName) {
      return res.status(400).json({ 
        status: "fail", 
        message: "All required fields must be provided" 
      });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ 
        status: "fail", 
        message: "Passwords do not match" 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        status: "fail", 
        message: "Password must be at least 8 characters" 
      });
    }

    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { pjNumber: pjNumber?.toLowerCase() }] 
    });
    
    if (existingUser) {
      return res.status(409).json({ 
        status: "fail", 
        message: "User with this email or PJ number already exists" 
      });
    }

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password,
      firstName,
      lastName,
      pjNumber: pjNumber?.toLowerCase(),
      role: role || "user",
      isActive: true,
    });

    // Remove password from output
    const userResponse = user.toObject();
    delete (userResponse as any).password;

    return res.status(201).json({
      status: "success",
      message: "User created successfully",
      data: { user: userResponse },
    });
  } catch (err) {
    console.error("Registration Error:", err);
    return next(new AppError("Internal server error", 500));
  }
};

/* =========================================================
   CHANGE PASSWORD
========================================================= */
export const changePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword, newPasswordConfirm } = req.body;
    const userId = (req as any).user?.id;

    if (!userId) {
      return next(new AppError("User not authenticated", 401));
    }

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      return res.status(400).json({ 
        status: "fail", 
        message: "All password fields are required" 
      });
    }

    if (newPassword !== newPasswordConfirm) {
      return res.status(400).json({ 
        status: "fail", 
        message: "New passwords do not match" 
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ 
        status: "fail", 
        message: "Password must be at least 8 characters" 
      });
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        status: "fail", 
        message: "Current password is incorrect" 
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      status: "success",
      message: "Password changed successfully",
    });
  } catch (err) {
    console.error("Change Password Error:", err);
    return next(new AppError("Internal server error", 500));
  }
};

/* =========================================================
   FORGOT PASSWORD - Send reset token
========================================================= */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        status: "fail", 
        message: "Email is required" 
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.isActive) {
      // Security: Don't reveal if user exists
      return res.status(200).json({ 
        status: "success", 
        message: "If your email is registered, you will receive a password reset link" 
      });
    }

    // Send password reset email
    await sendPasswordResetToken(user);

    return res.status(200).json({
      status: "success",
      message: "Password reset link sent to email",
    });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    return next(new AppError("Internal server error", 500));
  }
};

/* =========================================================
   RESET PASSWORD
========================================================= */
export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, password, passwordConfirm } = req.body;

    if (!token || !password || !passwordConfirm) {
      return res.status(400).json({ 
        status: "fail", 
        message: "Token and new password are required" 
      });
    }

    if (password !== passwordConfirm) {
      return res.status(400).json({ 
        status: "fail", 
        message: "Passwords do not match" 
      });
    }

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({ 
        status: "fail", 
        message: "Token is invalid or has expired" 
      });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Send password reset confirmation email
    // await sendPasswordResetConfirmation(user.email);

    return res.status(200).json({
      status: "success",
      message: "Password reset successful. Please login with your new password",
    });
  } catch (err) {
    console.error("Reset Password Error:", err);
    return next(new AppError("Internal server error", 500));
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
    if (!token) {
      return next(new AppError("Session expired, please login again", 401));
    }

    const payload = verifyRefreshToken(token);
    const user = await User.findById(payload.id);
    
    if (!user || !user.isActive) {
      return next(new AppError("User no longer exists", 401));
    }

    setTokenCookies(res, user);

    return res.status(200).json({
      status: "success",
      message: "Tokens refreshed",
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    return next(new AppError("Invalid refresh token", 401));
  }
};

/* =========================================================
   LOGOUT
========================================================= */
export const logout = async (_req: Request, res: Response) => {
  res.cookie("accessToken", "", { maxAge: 0, httpOnly: true });
  res.cookie("refreshToken", "", { maxAge: 0, httpOnly: true });
  res.status(200).json({ 
    status: "success", 
    message: "Logged out successfully" 
  });
};

/* =========================================================
   GET CURRENT USER
========================================================= */
export const getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    const user = await User.findById(userId).select("-password");
    
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    return res.status(200).json({
      status: "success",
      data: { user },
    });
  } catch (err) {
    return next(new AppError("Internal server error", 500));
  }
};