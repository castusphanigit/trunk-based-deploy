import { body, param, query } from "express-validator";

export const createUserValidator = [
  body("first_name").notEmpty().withMessage("First name is required"),
  body("last_name").notEmpty().withMessage("Last name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("phone_number")
    .optional()
    .matches(/^\+[1-9]\d{1,14}$/)
    .withMessage("Phone number must follow E.164 format"),
  body("designation").optional().isString(),
  body("avatar").optional().isURL().withMessage("Avatar must be a valid URL"),
  body("status").isIn(["ACTIVE", "INACTIVE"]).withMessage("Invalid status"),
  body("is_customer_user").isBoolean(),
  body("user_role_id").isInt().withMessage("user_role_id must be an integer"),
  body("customer_id").isInt().withMessage("customer_id must be an integer"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long"),
  body("assigned_account_ids")
    .optional()
    .isArray()
    .withMessage("assigned_account_ids must be an array of integers"),
];

export const updateUserValidator = [
  body("first_name").optional().isString(),
  body("last_name").optional().isString(),
  body("email").optional().isEmail(),
  body("phone_number")
    .optional()
    .matches(/^\+[1-9]\d{1,14}$/)
    .withMessage("Phone number must follow E.164 format"),
  body("designation").optional().isString(),
  body("avatar").optional().isURL(),
  body("status").optional().isIn(["ACTIVE", "INACTIVE"]),
  body("is_customer_user").optional().isBoolean(),
  body("user_role_id").optional().isInt(),
  body("customer_id").optional().isInt(),
  body("password").optional().isLength({ min: 8 }),
  body("assigned_account_ids").optional().isArray(),
];

export const deleteUserValidator = [
  param("user_id").isInt().withMessage("user_id must be an integer"),
];

export const validateUserIdParam = [
  param("user_id")
    .isInt({ gt: 0 })
    .withMessage("userId must be a positive integer"),
];

export const validateGetUsersByCustomerId = [
  query("customer_id")
    .exists()
    .withMessage("customer_id is required")
    .isInt({ gt: 0 })
    .withMessage("customer_id must be a positive integer"),
];

export const createUserColumnPreferenceValidator = [
  body("user_id")
    .notEmpty()
    .withMessage("user_id is required")
    .isString()
    .withMessage("user_id must be a string"),

  body("table_name")
    .notEmpty()
    .withMessage("table_name is required")
    .isString()
    .withMessage("table_name must be a string"),

  body("selected_columns")
    .isArray({ min: 1 })
    .withMessage("selected_columns must be a non-empty array")
    .custom((columns) => {
      if (!columns.every((col: any) => typeof col === "string")) {
        throw new Error("All selected_columns must be strings");
      }
      return true;
    }),
];

// export const validateUserIdParam = [
//   param("user_id").isNumeric().withMessage("user_id must be a number"),
// ]

export const validateTableNameParam = [
  param("table_name")
    .notEmpty()
    .withMessage("table_name parameter is required")
    .isString()
    .withMessage("table_name must be a valid string"),
];

export const validateUserAndTableParams = [
  param("user_id")
    .notEmpty()
    .withMessage("user_id parameter is required")
    .isNumeric()
    .withMessage("user_id must be a number"),
  param("table_name")
    .notEmpty()
    .withMessage("table_name parameter is required")
    .isString()
    .withMessage("table_name must be a valid string"),
];
