import { body, param, query } from "express-validator";

export const createPaymentValidator = [
  body("paymentId")
    .notEmpty()
    .withMessage("Payment ID is required")
    .isString()
    .withMessage("Payment ID must be a string"),
  
  body("paymentDate")
    .notEmpty()
    .withMessage("Payment date is required")
    .isISO8601()
    .withMessage("Payment date must be a valid ISO 8601 date"),
  
  body("paymentMethod")
    .notEmpty()
    .withMessage("Payment method is required")
    .isString()
    .withMessage("Payment method must be a string")
    .isIn(["Credit Card", "Bank Transfer", "Check", "Cash", "ACH", "Wire Transfer"])
    .withMessage("Payment method must be one of: Credit Card, Bank Transfer, Check, Cash, ACH, Wire Transfer"),
  
  body("payerName")
    .notEmpty()
    .withMessage("Payer name is required")
    .isString()
    .withMessage("Payer name must be a string")
    .isLength({ min: 2, max: 255 })
    .withMessage("Payer name must be between 2 and 255 characters"),
  
  body("payerEntity")
    .optional()
    .isString()
    .withMessage("Payer entity must be a string")
    .isLength({ max: 255 })
    .withMessage("Payer entity must not exceed 255 characters"),
  
  body("invoicePayments")
    .notEmpty()
    .withMessage("Invoice payments count is required")
    .isInt({ min: 0 })
    .withMessage("Invoice payments must be a non-negative integer"),
  
  body("invoiceCredits")
    .notEmpty()
    .withMessage("Invoice credits count is required")
    .isInt({ min: 0 })
    .withMessage("Invoice credits must be a non-negative integer"),
  
  body("paymentAmount")
    .notEmpty()
    .withMessage("Payment amount is required")
    .isFloat({ min: 0.01 })
    .withMessage("Payment amount must be greater than 0"),
  
  body("account_id")
    .notEmpty()
    .withMessage("Account ID is required")
    .isInt({ min: 1 })
    .withMessage("Account ID must be a positive integer"),
  
  body("invoiceIds")
    .optional()
    .isArray()
    .withMessage("Invoice IDs must be an array"),
  
  body("invoiceIds.*")
    .if(body("invoiceIds").exists())
    .isInt({ min: 1 })
    .withMessage("Each invoice ID must be a positive integer"),
];

export const updatePaymentValidator = [
  body("paymentId")
    .optional()
    .isString()
    .withMessage("Payment ID must be a string"),
  
  body("paymentDate")
    .optional()
    .isISO8601()
    .withMessage("Payment date must be a valid ISO 8601 date"),
  
  body("paymentMethod")
    .optional()
    .isString()
    .withMessage("Payment method must be a string")
    .isIn(["Credit Card", "Bank Transfer", "Check", "Cash", "ACH", "Wire Transfer"])
    .withMessage("Payment method must be one of: Credit Card, Bank Transfer, Check, Cash, ACH, Wire Transfer"),
  
  body("payerName")
    .optional()
    .isString()
    .withMessage("Payer name must be a string")
    .isLength({ min: 2, max: 255 })
    .withMessage("Payer name must be between 2 and 255 characters"),
  
  body("payerEntity")
    .optional()
    .isString()
    .withMessage("Payer entity must be a string")
    .isLength({ max: 255 })
    .withMessage("Payer entity must not exceed 255 characters"),
  
  body("invoicePayments")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Invoice payments must be a non-negative integer"),
  
  body("invoiceCredits")
    .optional()
    .isInt({ min: 0 })
    .withMessage("Invoice credits must be a non-negative integer"),
  
  body("paymentAmount")
    .optional()
    .isFloat({ min: 0.01 })
    .withMessage("Payment amount must be greater than 0"),
  
  body("invoiceIds")
    .optional()
    .isArray()
    .withMessage("Invoice IDs must be an array"),
  
  body("invoiceIds.*")
    .if(body("invoiceIds").exists())
    .isInt({ min: 1 })
    .withMessage("Each invoice ID must be a positive integer"),
];

export const paymentIdValidator = [
  param("id")
    .notEmpty()
    .withMessage("Payment ID is required")
    .isInt({ min: 1 })
    .withMessage("Payment ID must be a positive integer"),
];

export const paymentPaginationValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),
  
  query("perPage")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Per page must be between 1 and 100"),
  
  query("paymentId")
    .optional()
    .isString()
    .withMessage("Payment ID must be a string"),
  
  query("paymentDate")
    .optional()
    .isISO8601()
    .withMessage("Payment date must be a valid ISO 8601 date"),
  
  query("paymentMethod")
    .optional()
    .isString()
    .withMessage("Payment method must be a string"),
  
  query("invoices")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Invoice ID must be a positive integer"),
  
  query("sort")
    .optional()
    .isString()
    .withMessage("Sort must be a string"),
];