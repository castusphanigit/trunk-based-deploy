import { body, param, query } from "express-validator";

export const createInvoiceValidator = [
  body("invoiceNumber")
    .notEmpty()
    .withMessage("Invoice number is required")
    .isString()
    .withMessage("Invoice number must be a string"),

  body("date")
    .notEmpty()
    .withMessage("Invoice date is required")
    .isISO8601()
    .withMessage("Date must be a valid ISO 8601 date"),

  body("dueDate")
    .notEmpty()
    .withMessage("Due date is required")
    .isISO8601()
    .withMessage("Due date must be a valid ISO 8601 date"),

  body("billingPeriod_start")
    .notEmpty()
    .withMessage("Billing period start is required")
    .isISO8601()
    .withMessage("Billing period start must be a valid ISO 8601 date"),

  body("billingPeriod_end")
    .notEmpty()
    .withMessage("Billing period end is required")
    .isISO8601()
    .withMessage("Billing period end must be a valid ISO 8601 date"),

  body("billingAddress")
    .notEmpty()
    .withMessage("Billing address is required")
    .isString()
    .withMessage("Billing address must be a string"),

  body("contactInfo")
    .notEmpty()
    .withMessage("Contact info is required")
    .isString()
    .withMessage("Contact info must be a string"),

  body("taxId")
    .notEmpty()
    .withMessage("Tax ID is required")
    .isString()
    .withMessage("Tax ID must be a string"),

  body("invoiceType")
    .optional()
    .isIn(["Lease", "Rent", "PM", "ERS", "Misc"])
    .withMessage("Invoice type must be one of: Lease, Rent, PM, ERS, Misc"),

  body("equipmentIds")
    .optional()
    .isArray()
    .withMessage("Equipment IDs must be an array"),

  body("equipmentIds.*")
    .if(body("equipmentIds").exists())
    .isInt({ min: 1 })
    .withMessage("Each equipment ID must be a positive integer"),

  body("description")
    .notEmpty()
    .withMessage("Description is required")
    .isString()
    .withMessage("Description must be a string"),

  body("quantity")
    .notEmpty()
    .withMessage("Quantity is required")
    .isInt({ min: 1 })
    .withMessage("Quantity must be a positive integer"),

  body("rate")
    .notEmpty()
    .withMessage("Rate is required")
    .isFloat({ min: 0 })
    .withMessage("Rate must be a non-negative number"),

  body("subTotal")
    .notEmpty()
    .withMessage("Subtotal is required")
    .isFloat({ min: 0 })
    .withMessage("Subtotal must be a non-negative number"),

  body("taxes")
    .notEmpty()
    .withMessage("Taxes is required")
    .isFloat({ min: 0 })
    .withMessage("Taxes must be a non-negative number"),

  body("discounts")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Discounts must be a non-negative number"),

  body("credits")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Credits must be a non-negative number"),

  body("totalAmount")
    .notEmpty()
    .withMessage("Total amount is required")
    .isFloat({ min: 0 })
    .withMessage("Total amount must be a non-negative number"),

  body("amountPaid")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Amount paid must be a non-negative number"),

  body("balanceDue")
    .notEmpty()
    .withMessage("Balance due is required")
    .isFloat({ min: 0 })
    .withMessage("Balance due must be a non-negative number"),

  body("account_id")
    .notEmpty()
    .withMessage("Account ID is required")
    .isInt({ min: 1 })
    .withMessage("Account ID must be a positive integer"),

  body("invoiceItems")
    .optional()
    .isArray()
    .withMessage("Invoice items must be an array"),

  body("invoiceItems.*.item_description")
    .if(body("invoiceItems").exists())
    .notEmpty()
    .withMessage("Item description is required")
    .isString()
    .withMessage("Item description must be a string"),

  body("invoiceItems.*.quantity")
    .if(body("invoiceItems").exists())
    .notEmpty()
    .withMessage("Item quantity is required")
    .isInt({ min: 1 })
    .withMessage("Item quantity must be a positive integer"),

  body("invoiceItems.*.rate")
    .if(body("invoiceItems").exists())
    .notEmpty()
    .withMessage("Item rate is required")
    .isFloat({ min: 0 })
    .withMessage("Item rate must be a non-negative number"),

  body("invoiceItems.*.amount")
    .if(body("invoiceItems").exists())
    .notEmpty()
    .withMessage("Item amount is required")
    .isFloat({ min: 0 })
    .withMessage("Item amount must be a non-negative number"),
];

export const updateInvoiceValidator = [
  body("invoiceNumber")
    .optional()
    .isString()
    .withMessage("Invoice number must be a string"),

  body("date")
    .optional()
    .isISO8601()
    .withMessage("Date must be a valid ISO 8601 date"),

  body("dueDate")
    .optional()
    .isISO8601()
    .withMessage("Due date must be a valid ISO 8601 date"),

  body("billingPeriod_start")
    .optional()
    .isISO8601()
    .withMessage("Billing period start must be a valid ISO 8601 date"),

  body("billingPeriod_end")
    .optional()
    .isISO8601()
    .withMessage("Billing period end must be a valid ISO 8601 date"),

  body("billingAddress")
    .optional()
    .isString()
    .withMessage("Billing address must be a string"),

  body("contactInfo")
    .optional()
    .isString()
    .withMessage("Contact info must be a string"),

  body("taxId").optional().isString().withMessage("Tax ID must be a string"),

  body("equipmentIds")
    .optional()
    .isArray()
    .withMessage("Equipment IDs must be an array"),

  body("equipmentIds.*")
    .if(body("equipmentIds").exists())
    .isInt({ min: 1 })
    .withMessage("Each equipment ID must be a positive integer"),

  body("description")
    .optional()
    .isString()
    .withMessage("Description must be a string"),

  body("quantity")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Quantity must be a positive integer"),

  body("rate")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Rate must be a non-negative number"),

  body("subTotal")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Subtotal must be a non-negative number"),

  body("taxes")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Taxes must be a non-negative number"),

  body("discounts")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Discounts must be a non-negative number"),

  body("credits")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Credits must be a non-negative number"),

  body("totalAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Total amount must be a non-negative number"),

  body("amountPaid")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Amount paid must be a non-negative number"),

  body("balanceDue")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Balance due must be a non-negative number"),

  body("invoiceItems")
    .optional()
    .isArray()
    .withMessage("Invoice items must be an array"),

  body("invoiceItems.*.item_description")
    .if(body("invoiceItems").exists())
    .optional()
    .isString()
    .withMessage("Item description must be a string"),

  body("invoiceItems.*.quantity")
    .if(body("invoiceItems").exists())
    .optional()
    .isInt({ min: 1 })
    .withMessage("Item quantity must be a positive integer"),

  body("invoiceItems.*.rate")
    .if(body("invoiceItems").exists())
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Item rate must be a non-negative number"),

  body("invoiceItems.*.amount")
    .if(body("invoiceItems").exists())
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Item amount must be a non-negative number"),
];

export const invoiceIdValidator = [
  param("id")
    .notEmpty()
    .withMessage("Invoice ID is required")
    .isInt({ min: 1 })
    .withMessage("Invoice ID must be a positive integer"),
];

export const paginationValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("perPage")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Per page must be between 1 and 100"),

  query("invoiceNumber")
    .optional()
    .isString()
    .withMessage("Invoice number must be a string"),

  query("invoiceDate")
    .optional()
    .isISO8601()
    .withMessage("Invoice date must be a valid ISO 8601 date"),

  query("dueDate")
    .optional()
    .isISO8601()
    .withMessage("Due date must be a valid ISO 8601 date"),

  query("accountId")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Account ID must be a positive integer"),

  query("invoiceType")
    .optional()
    .isIn(["Lease", "Rent", "PM", "ERS", "Misc"])
    .withMessage("Invoice type must be one of: Lease, Rent, PM, ERS, Misc"),

  query("sort").optional().isString().withMessage("Sort must be a string"),
];

export const creditInvoicesValidator = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("perPage")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Per page must be between 1 and 100"),

  query("accountIds")
    .optional()
    .custom((value) => {
      if (typeof value === "string") {
        // Check if it's a comma-separated list of numbers
        const ids = value.split(",").map((id) => id.trim());
        return ids.every((id) => !isNaN(Number(id)) && Number(id) > 0);
      }
      return true;
    })
    .withMessage("Account IDs must be comma-separated positive integers"),

  query("status").optional().isString().withMessage("Status must be a string"),

  query("creditType")
    .optional()
    .isString()
    .withMessage("Credit type must be a string"),

  query("dateFrom")
    .optional()
    .isISO8601()
    .withMessage("Date from must be a valid ISO 8601 date"),

  query("dateTo")
    .optional()
    .isISO8601()
    .withMessage("Date to must be a valid ISO 8601 date"),

  query("creditInvoiceNumber")
    .optional()
    .isString()
    .withMessage("Credit invoice number must be a string"),

  query("accountNumber")
    .optional()
    .isString()
    .withMessage("Account number must be a string"),

  query("sort").optional().isString().withMessage("Sort must be a string"),
];
