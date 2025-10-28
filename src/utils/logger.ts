import { createLogger, format, transports } from "winston";
import path from "path";
import fs from "fs";

// Ensure logs directory exists
const logDir = path.join(__dirname, "../../logs");
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    format.errors({ stack: true }),
    format.splat(),
    format.json()
  ),
  defaultMeta: { service: "workorder-service" },
  transports: [
    // Error logs ONLY
    new transports.File({
      filename: path.join(logDir, "error.log"),
      level: "error",
      format: format((info) => info.level === 'error' ? info : false)() // Filter: only errors
    }),
    // Success/info logs ONLY (no errors)
    new transports.File({
      filename: path.join(logDir, "success.log"),
      level: "info",
      format: format((info) => info.level !== 'error' ? info : false)() // Filter: everything except errors
    }),
  ],
});

// Optional: log to console in development
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: format.combine(format.colorize(), format.simple()),
    })
  );
}

export default logger;
