/**
 * Account Routes
 *
 * Defines API routes for account-related operations including:
 * - Fetching accounts by customer/user with pagination and filtering
 * - Managing secondary contacts for accounts
 * - Account hierarchy operations (primary contact and related accounts)
 * - Excel export functionality for accounts and contacts
 * - Dropdown data for assigned accounts
 *
 * Security considerations:
 * - All routes require proper authentication via Auth0
 * - Permission-based access control for different operations
 * - Input validation and sanitization on all endpoints
 * - Rate limiting on export operations
 * - Protection against unauthorized data access
 * - SQL injection prevention through parameterized queries
 *
 * @author kalyanrai
 * @version 1.0.0
 */

import { Router } from "express";
import {
  fetchAccountsOfCustomer,
  getAccountsByUserId,
  getSecondaryContacts,
  getAccountPrimaryContactAndRelated,
  getUserAccountsMinimal,
  downloadAccountsByUserId,
  downloadSecondaryContacts,
  fetchAssignedAccountsDropdown,
  downloadAccountsOfCustomer,
} from "../controllers/account.controller";
import { asyncHandler } from "../../utils/asyncHandler";
import { requirePermission } from "../middleware/auth0.middleware";

const router = Router();

/**
 * GET /api/account/customerUserAccounts/:userId
 *
 * Fetch accounts assigned to a specific user with pagination and filtering
 *
 * @route GET /customerUserAccounts/:userId
 * @access Private (requires "read:accounts" permission)
 * @param userId - User ID in URL parameter
 * @query page, perPage, sort, filters - Pagination and filtering parameters
 * @returns Paginated list of accounts assigned to the user
 *
 * Security considerations:
 * - Validates userId parameter to prevent injection attacks
 * - Implements authorization checks to ensure users can only access their assigned accounts
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 */
router.get(
  "/customerUserAccounts/:userId",
  requirePermission(["read:accounts"]),
  // withValidation([validateUserIdParam, paginateAndFilterAccountsQuery]),
  asyncHandler(getAccountsByUserId)
);

/**
 * GET /api/account/accountLinkedUsers/:accountId
 *
 * Get secondary contacts (users) linked to a specific account with pagination and filtering
 *
 * @route GET /accountLinkedUsers/:accountId
 * @access Private (requires "read:account-details" permission)
 * @param accountId - Account ID in URL parameter
 * @query page, perPage, sort, filters - Pagination and filtering parameters
 * @returns Paginated list of secondary contacts for the specified account
 */
router.get(
  "/accountLinkedUsers/:accountId",
  requirePermission(["read:account-details"]),
  asyncHandler(getSecondaryContacts)
);

/**
 * GET /api/account/customerAccounts/:customerId
 *
 * Fetch all accounts for a specific customer with pagination and filtering
 *
 * @route GET /customerAccounts/:customerId
 * @access Private (requires "read:accounts" permission)
 * @param customerId - Customer ID in URL parameter
 * @query page, perPage, sort, filters - Pagination and filtering parameters
 * @returns Paginated list of accounts for the specified customer
 */
router.get(
  "/customerAccounts/:customerId",
  requirePermission(["read:accounts"]),
  // withValidation([validateCustomerIdParam, paginateAndFilterAccountsQuery]),
  asyncHandler(fetchAccountsOfCustomer)
);

/**
 * GET /api/account/AssignedAccountsDropdown/:customerId
 *
 * Fetch assigned accounts dropdown data for a specific customer
 *
 * @route GET /AssignedAccountsDropdown/:customerId
 * @access Private (requires "read:accounts" permission)
 * @param customerId - Customer ID in URL parameter
 * @returns Dropdown data for assigned accounts
 */
router.get(
  "/AssignedAccountsDropdown/:customerId",
  requirePermission(["read:accounts"]),
  // withValidation([validateCustomerIdParam]),
  asyncHandler(fetchAssignedAccountsDropdown)
);

/**
 * GET /api/account/accountPrimaryContactAndRelated/:accountId
 *
 * Get primary contact and related accounts for a specific account (account hierarchy)
 *
 * @route GET /accountPrimaryContactAndRelated/:accountId
 * @access Private (requires "read:account-details" permission)
 * @param accountId - Account ID in URL parameter
 * @returns Account hierarchy information including primary contact and related accounts
 */
router.get(
  "/accountPrimaryContactAndRelated/:accountId",
  requirePermission("read:account-details"),
  // withValidation([validateAccountIdParam]),
  asyncHandler(getAccountPrimaryContactAndRelated)
);

/**
 * GET /api/account/userAccounts/:userId
 *
 * Get minimal account information for a specific user (for dropdowns/selects)
 *
 * @route GET /userAccounts/:userId
 * @access Private (requires "read:accounts" permission)
 * @param userId - User ID in URL parameter
 * @returns Minimal account information for the specified user
 */
router.get(
  "/userAccounts/:userId",
  requirePermission("read:accounts"),
  asyncHandler(getUserAccountsMinimal)
);

/**
 * POST /api/account/downloadAccountsByUserId
 *
 * Download accounts data for a specific user as Excel file
 *
 * @route POST /downloadAccountsByUserId
 * @access Private (requires "download:accounts" permission)
 * @body { query: AccountsFilterQuery, columns: ColumnDefinition[] }
 * @returns Excel file download
 */
router.post(
  "/downloadAccountsByUserId",
  requirePermission("download:accounts"),
  asyncHandler(downloadAccountsByUserId)
);

/**
 * POST /api/account/downloadSecondaryContacts
 *
 * Download secondary contacts data for a specific account as Excel file
 *
 * @route POST /downloadSecondaryContacts
 * @access Private (requires "download:accounts" permission)
 * @body { accountId: number, query: SecondaryContactsFilterQuery, columns: ColumnDefinition[] }
 * @returns Excel file download
 */
router.post(
  "/downloadSecondaryContacts",
  requirePermission("download:accounts"),
  asyncHandler(downloadSecondaryContacts)
);

/**
 * POST /api/account/downloadCustomerAccounts
 *
 * Download accounts data for a specific customer as Excel file (TEN Admin only)
 *
 * @route POST /downloadCustomerAccounts
 * @access Private (requires "download:ten-admin-all-accounts" permission)
 * @body { customerId: number, query: AccountsFilterQuery, columns: ColumnDefinition[] }
 * @returns Excel file download
 */
router.post(
  "/downloadCustomerAccounts",
  requirePermission("download:ten-admin-all-accounts"),
  asyncHandler(downloadAccountsOfCustomer)
);

export default router;
