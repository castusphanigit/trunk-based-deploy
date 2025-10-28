// ──────────────────────────────────────────────────────────────────────────────
import { query, param } from "express-validator";

export const validateCustomerIdParam = [
  param("customerId")
    .isInt({ gt: 0 })
    .withMessage("customerId must be a positive integer"),
];
export const validateUserIdParam = [
  param("userId")
    .isInt({ gt: 0 })
    .withMessage("userId must be a positive integer"),
];
export const validateAccountIdParam = [
  param("accountId")
    .isInt({ gt: 0 })
    .withMessage("accountId must be a positive integer"),
];

export const paginateAndFilterAccountsQuery = [
  query("page").optional().isInt({ min: 1 }),
  query("perPage").optional().isInt({ min: 1, max: 200 }),
  query("account_name").optional().isString(),
  query("account_number").optional().isString(),
  query("legacy_account_number").optional().isString(),
  query("account_type").optional().isString(),
  query("account_manager_id").optional().isInt({ min: 1 }),
  query("status").optional().isString(),
  query("country_lookup_id").optional().isInt({ min: 1 }),
  query("number_of_users").optional().isInt({ min: 0 }),
  query("is_deleted").optional().isBoolean().toBoolean(),
];

export const paginateSecondaryContactsQuery = [
  query("page").optional().isInt({ min: 1 }),
  query("perPage").optional().isInt({ min: 1, max: 200 }),
  query("first_name").optional().isString(),
  query("last_name").optional().isString(),
  query("email").optional().isString(),
  query("designation").optional().isString(),
  query("status").optional().isString(),
  query("phone_number").optional().isString(),
];
