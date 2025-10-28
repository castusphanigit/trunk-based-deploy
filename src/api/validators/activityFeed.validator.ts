import { body } from "express-validator";

export const createActivityFeedValidator = [
  body("customer_id")
    .isInt({ min: 1 })
    .withMessage("Customer ID must be a positive integer"),

  body("created_by")
    .isInt({ min: 1 })
    .withMessage("Created by user ID must be a positive integer"),

  body("latitude")
    .isFloat({ min: -90, max: 90 })
    .withMessage("Latitude must be a valid number between -90 and 90"),

  body("longitude")
    .isFloat({ min: -180, max: 180 })
    .withMessage("Longitude must be a valid number between -180 and 180"),

  body("equipment_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Equipment ID must be a positive integer"),

  body("account_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Account ID must be a positive integer"),

  body("geofence_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Geofence ID must be a positive integer"),

  body("telematic_alert_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Telematic alert ID must be a positive integer"),

  body("alert_type_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Alert type ID must be a positive integer"),

  body("alert_category_id")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Alert category ID must be a positive integer"),

  body("event_time")
    .optional()
    .isISO8601()
    .withMessage("Event time must be a valid ISO 8601 date string"),
];
