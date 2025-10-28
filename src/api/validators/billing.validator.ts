import { body, param } from "express-validator";

export const accountIdValidator = [
  param("accountId")
    .notEmpty()
    .withMessage("Account ID is required")
    .isInt({ min: 1 })
    .withMessage("Account ID must be a positive integer"),
];

export const paymentIdValidator = [
  param("paymentId")
    .notEmpty()
    .withMessage("Payment ID is required")
    .isInt({ min: 1 })
    .withMessage("Payment ID must be a positive integer"),
];

export const applyPaymentValidator = [
  body("invoiceAllocations")
    .notEmpty()
    .withMessage("Invoice allocations are required")
    .isArray({ min: 1 })
    .withMessage("Invoice allocations must be a non-empty array"),
  
  body("invoiceAllocations.*.invoiceId")
    .notEmpty()
    .withMessage("Invoice ID is required")
    .isInt({ min: 1 })
    .withMessage("Invoice ID must be a positive integer"),
  
  body("invoiceAllocations.*.amount")
    .notEmpty()
    .withMessage("Allocation amount is required")
    .isFloat({ min: 0.01 })
    .withMessage("Allocation amount must be greater than 0"),
];