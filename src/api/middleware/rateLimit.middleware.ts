import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { getRateLimitConfig } from "../../config/env.config";

// Get rate limit configuration
const rateLimitConfig = getRateLimitConfig();

// Custom message handler
const rateLimitHandler = (req: Request, res: Response) => {
  res.status(429).json({
    message: "Too many requests, please try again later.",
    retryAfter: rateLimitConfig.retryAfterMinutes, // in minutes
  });
};

// General rate limit for most APIs
export const generalLimiter = rateLimit({
  windowMs: rateLimitConfig.windowMs, // 15 minutes default
  max: rateLimitConfig.maxRequests, // 100 requests per window
  message: "Too many requests from this IP, please try again later.",
  handler: rateLimitHandler,
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Stricter limit for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: rateLimitConfig.maxRequests, // 5 attempts per window
  message: "Too many authentication attempts, please try again later.",
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limit for file uploads
export const fileUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per window
  message: "Too many file uploads, please try again later.",
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
});

// More generous limit for download endpoints
export const downloadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 downloads per window
  message: "Too many download requests, please try again later.",
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
});

// Very strict limit for sensitive operations (user creation, updates)
export const sensitiveOperationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 operations per window
  message: "Too many sensitive operations, please try again later.",
  handler: rateLimitHandler,
  standardHeaders: true,
  legacyHeaders: false,
});
