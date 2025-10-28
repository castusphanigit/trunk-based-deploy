import express, { Express, Request, Response, NextFunction } from "express";
import createError from "http-errors";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import dotenv from "dotenv";
import helmet from "helmet";
import { getCorsOrigins, isDevelopment } from "./src/config/env.config";


import accountRoutes from "./src/api/routes/account.routes";
import FleetViewRouter from "./src/api/routes/fleet.view.routes";
import geoFenceRouter from "./src/api/routes/geofence.routes";
import tagLookup from "./src/api/routes/tagLookup.routes";
import RolesRouter from "./src/api/routes/roles.routes";
import UsersRouter from "./src/api/routes/users.routes";
import authRouter from "./src/api/routes/auth.routes";
import telematicsAlertsRouter from "./src/api/routes/telematicsAlerts.routes";
import pmRouter from "./src/api/routes/pm.dot.routes";
import deliveryMethodRoutes from "./src/api/routes/deliveryMethod.master.routes";
import serviceRequestRoutes from "./src/api/routes/serviceRequest.routes";
import workOrderRoutes from "./src/api/routes/workorders.routes";
import agreementRoutes from "./src/api/routes/agreement.routes";
import ersRoutes from "./src/api/routes/ers.routes";
import fileupload from "./src/api/routes/fileupload.routes";
import alertCategoryLookupRouter from "./src/api/routes/alert.category.lookup.routes";
import alertTypeLookupRouter from "./src/api/routes/alert.type.lookup.routes";
import activityFeedRoutes from "./src/api/routes/activityFeed.routes";
import dashboardRoutes from "./src/api/routes/dashboard.routes";
import globalSearch from "./src/api/routes/search.routes";
import invoiceRoutes from "./src/api/routes/invoices.routes";
import paymentRoutes from "./src/api/routes/payments.routes";
import billingRoutes from "./src/api/routes/billing.routes";

import {
  UnauthorizedError,
  InvalidRequestError,
  InvalidTokenError,
  InsufficientScopeError,
} from "express-oauth2-jwt-bearer";

import cors from "cors";
import prisma from "./src/config/database.config";

// Load environment variables early
dotenv.config();

const app: Express = express();
// Set security HTTP headers
app.use(helmet());
interface AppError extends Error {
  status?: number;
}

// Database connection monitoring
const monitorDatabaseConnection = async () => {
  try {
    // Test connection
    await prisma.$connect();

    // Get connection info
    const result =
      await prisma.$queryRaw`SELECT version() as db_version, current_database() as db_name`;
    console.log("Database connected:", result);
    // Set up connection health check
    setInterval(async () => {
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        console.error(" Database connection health check failed:", error);
      }
    }, 30000); // Check every 30 seconds
  } catch (error) {
    console.error("Error details:", error);
  }
};

// Initialize database monitoring
monitorDatabaseConnection();

// CORS configuration
const corsOptions: cors.CorsOptions = {
  origin: getCorsOrigins(),
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// Middleware setup
app.use(cors(corsOptions));
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// Apply general rate limiting to all routes
///app.use(generalLimiter);

// Attach Prisma to each request
app.use((req: Request, res: Response, next: NextFunction) => {
  req.prisma = prisma;
  next();
});

// API Routes with specific rate limiting

// Auth routes - stricter limits
app.use("/api/auth", authRouter);
// File upload routes - specific limits
app.use("/api/fileupload", fileupload);

// User routes - sensitive operations get stricter limits
app.use("/api/user", UsersRouter);

// Other routes use the general limiter
app.use("/api/roles", RolesRouter);
app.use("/api/account", accountRoutes);
app.use("/api/fleet", FleetViewRouter);
app.use("/api/geofence", geoFenceRouter);
app.use("/api/tagLookup", tagLookup);
app.use("/api/telematicsAlerts", telematicsAlertsRouter);
app.use("/api", pmRouter);
app.use("/api/delivery-methods", deliveryMethodRoutes);
app.use("/api/serviceRequest", serviceRequestRoutes);
app.use("/api/workorder", workOrderRoutes);
app.use("/api/agreement", agreementRoutes);
app.use("/api/ers", ersRoutes);
app.use("/api/alert-category-lookup", alertCategoryLookupRouter);
app.use("/api/alert-type-lookup", alertTypeLookupRouter);
app.use("/api/activity-feed", activityFeedRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/globalsearch", globalSearch);
app.use("/api/invoices",  invoiceRoutes);
app.use("/api/payments",  paymentRoutes);
app.use("/api/billing",  billingRoutes);
// 404 Error Catcher
app.use(function (req: Request, res: Response, next: NextFunction) {
  next(createError(404));
});

const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // JWT errors from express-oauth2-jwt-bearer
  if (
    err instanceof UnauthorizedError ||
    err instanceof InvalidRequestError ||
    err instanceof InvalidTokenError ||
    err instanceof InsufficientScopeError
  ) {
    let friendlyMessage = "Unauthorized";

    if (err instanceof InvalidRequestError) {
      friendlyMessage = "No token provided";
    } else if (err instanceof InvalidTokenError) {
      if (err.message.includes("expired")) {
        friendlyMessage = "Token expired";
      } else {
        friendlyMessage = "Invalid token";
      }
    } else if (err instanceof InsufficientScopeError) {
      friendlyMessage = "Insufficient permissions";
    }

    return res.status(401).json({
      message: friendlyMessage,
    });
  }

  // All other errors (your old logic)
  const error = err as AppError;
  res.status(error.status ?? 500).json({
    message: error.message ?? "Unknown issue occurred",
    error: isDevelopment() ? error : undefined,
  });
};

app.use(errorHandler);

export default app;
