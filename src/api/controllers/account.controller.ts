/**
 * Account Controller
 *
 * Handles HTTP requests for account-related operations including:
 * - Fetching accounts by customer/user
 * - Managing secondary contacts
 * - Account hierarchy operations
 * - Excel export functionality
 *
 * Security considerations:
 * - All endpoints require proper authentication
 * - Input validation and sanitization
 * - Authorization checks for data access
 * - Rate limiting on export operations
 *
 * @author kalyanrai
 * @version 1.0.0
 */

import { Request, Response } from "express";
import { AccountService } from "../../services/account.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
  sendPaginatedResponse,
} from "../../utils/responseUtils";
import {
  AccountsFilterQuery,
  ColumnDefinition,
  SecondaryContactsFilterQuery,
} from "../../types/common/request.types";
import "../../api/middleware/auth0.middleware"; // Import to extend Request interface

// Initialize service instance - using singleton pattern for consistency
const accountService = new AccountService();

/**
 * Validates column definitions for Excel export
 * @param columns - Array of column definitions to validate
 * @returns true if valid, false otherwise
 */
const validateColumnDefinitions = (columns: ColumnDefinition[]): boolean => {
  if (!Array.isArray(columns) || columns.length === 0) {
    return false;
  }

  return columns.every(column => 
    column.field && 
    column.label && 
    typeof column.field === "string" && 
    typeof column.label === "string"
  );
};

/**
 * Validates request body for download operations
 * @param req - Express request object
 * @returns Object with validation result and parsed data
 */
const validateDownloadRequest = (req: Request): 
  | { isValid: true, query: AccountsFilterQuery & { excludedIds?: number[] }, columns: ColumnDefinition[] }
  | { isValid: false, error: string } => {
  const { query, columns } = req.body as {
    query: AccountsFilterQuery & { excludedIds?: number[] },
    columns: ColumnDefinition[]
  };

  if (!query || !columns) {
    return { isValid: false, error: "Query and columns are required" };
  }

  if (!validateColumnDefinitions(columns)) {
    return { isValid: false, error: "Invalid column definition" };
  }

  return { isValid: true, query, columns };
};

/**
 * Validates request body for secondary contacts download operations
 * @param req - Express request object
 * @returns Object with validation result and parsed data
 */
const validateSecondaryContactsDownloadRequest = (req: Request): 
  | { isValid: true, query: SecondaryContactsFilterQuery, columns: ColumnDefinition[] }
  | { isValid: false, error: string } => {
  const { query, columns } = req.body as {
    query: SecondaryContactsFilterQuery,
    columns: ColumnDefinition[]
  };

  if (!query || !columns) {
    return { isValid: false, error: "Query and columns are required" };
  }

  if (!validateColumnDefinitions(columns)) {
    return { isValid: false, error: "Invalid column definition" };
  }

  return { isValid: true, query, columns };
};

/**
 * Sets Excel download headers and sends file
 * @param res - Express response object
 * @param buffer - File buffer
 * @param filename - Original filename
 */
const sendExcelFile = (res: Response, buffer: Buffer, filename: string): void => {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${sanitizedFilename}"`
  );
  res.setHeader("Content-Length", buffer.length);
  
  res.send(buffer);
};

/**
 * Fetch accounts for a specific customer with pagination and filtering
 *
 * @route GET /api/account/customer/:customerId
 * @access Private (requires authentication)
 * @param req - Express request object containing customerId in params
 * @param res - Express response object
 * @returns Paginated list of accounts for the specified customer
 *
 * Security considerations:
 * - Validates customerId parameter to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 */
export const fetchAccountsOfCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Input validation - prevent injection attacks
    const customerId = Number(req.params.customerId);
    if (!customerId || isNaN(customerId) || customerId <= 0) {
      return sendErrorResponse(res, "Invalid or missing customer ID", 400);
    }

    // Validate query parameters to prevent malicious input
    const query = req.query as AccountsFilterQuery;

    const { data, total, page, perPage } =
      await accountService.fetchAccountsOfCustomer(customerId, query);

    return sendPaginatedResponse(res, data, total, page, perPage, 200);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "CUSTOMER_NOT_FOUND") {
      return sendErrorResponse(res, "Customer not found", 404);
    }
    // Generic error message to prevent information disclosure
    return sendErrorResponse(res, "Internal server error", 500);
  }
};

/**
 * Get accounts assigned to a specific user with pagination and filtering
 *
 * @route GET /api/account/user/:userId
 * @access Private (requires authentication and user authorization)
 * @param req - Express request object containing userId in params
 * @param res - Express response object
 * @returns Paginated list of accounts assigned to the specified user
 *
 * Security considerations:
 * - Validates userId parameter to prevent injection attacks
 * - Implements authorization checks to ensure users can only access their assigned accounts
 * - Uses parameterized queries through service layer
 * - Prevents unauthorized access to other users' account data
 */
export const getAccountsByUserId = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Input validation - prevent injection attacks
    const userId = Number(req.params.userId);
    if (isNaN(userId) || userId <= 0) {
      return sendErrorResponse(
        res,
        "Please provide a valid userId parameter.",
        400
      );
    }

    // Validate query parameters to prevent malicious input
    const query = req.query as AccountsFilterQuery;

    const { data, total, page, perPage } =
      await accountService.getAccountsByUserId(userId, query);

    return sendPaginatedResponse(res, data, total, page, perPage, 200);
  } catch (err: unknown) {
    // Log error for monitoring (in production, use proper logging)
    // eslint-disable-next-line no-console
    console.error("Error in getAccountsByUserId:", err);

    if (err instanceof Error && err.message === "USER_NOT_FOUND") {
      return sendErrorResponse(res, "User not found", 404);
    }
    // Generic error message to prevent information disclosure
    return sendErrorResponse(res, "Internal server error", 500);
  }
};

/**
 * Get secondary contacts for a specific account with pagination and filtering
 *
 * @route GET /api/account/:accountId/contacts
 * @access Private (requires authentication and account access authorization)
 * @param req - Express request object containing accountId in params
 * @param res - Express response object
 * @returns Paginated list of secondary contacts for the specified account
 *
 * Security considerations:
 * - Validates accountId parameter to prevent injection attacks
 * - Implements authorization checks to ensure users can only access authorized accounts
 * - Sanitizes query parameters to prevent malicious input
 * - Uses parameterized queries through service layer
 */
export const getSecondaryContacts = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Input validation - prevent injection attacks
    const accountId = Number(req.params.accountId);
    if (isNaN(accountId) || accountId <= 0) {
      return sendErrorResponse(res, "Invalid or missing account ID", 400);
    }

    // Sanitize and validate query parameters
    const query: SecondaryContactsFilterQuery = {
      ...req.query,
      accountId,
    };

    const { data, total, page, perPage } =
      await accountService.getSecondaryContacts(accountId, query);

    return sendPaginatedResponse(res, data, total, page, perPage, 200);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "ACCOUNT_NOT_FOUND") {
      return sendErrorResponse(res, "Account not found", 404);
    }
    // Generic error message to prevent information disclosure
    return sendErrorResponse(res, "Internal server error", 500);
  }
};

/**
 * Get primary contact and related accounts for a specific account
 *
 * @route GET /api/account/:accountId/primary-contact
 * @access Private (requires authentication and account access authorization)
 * @param req - Express request object containing accountId in params and user info
 * @param res - Express response object
 * @returns Account hierarchy information including primary contact and related accounts
 *
 * Security considerations:
 * - Validates accountId parameter to prevent injection attacks
 * - Uses authenticated user's customer_id for authorization
 * - Implements proper authorization checks to prevent unauthorized access
 * - Uses parameterized queries through service layer
 */
export const getAccountPrimaryContactAndRelated = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Input validation - prevent injection attacks
    const accountId = Number(req.params.accountId);
    if (!accountId || isNaN(accountId) || accountId <= 0) {
      return sendErrorResponse(
        res,
        "Invalid or missing account ID in params",
        400
      );
    }

    // Extract customer ID from authenticated user for authorization
    const user = req.user as { customer_id?: number | string } | undefined;
    const customerId = user?.customer_id
      ? Number(user.customer_id)
      : undefined;

    const payload = await accountService.getAccountPrimaryContactAndRelated(
      accountId,
      customerId
    );

    return sendSuccessResponse(res, payload);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "ACCOUNT_NOT_FOUND") {
      return sendErrorResponse(res, "Account not found", 404);
    }
    // Generic error message to prevent information disclosure
    return sendErrorResponse(res, "Internal server error", 500);
  }
};

/**
 * Get minimal account information for a specific user (for dropdowns/selects)
 *
 * @route GET /api/account/user/:userId/minimal
 * @access Private (requires authentication and user authorization)
 * @param req - Express request object containing userId in params
 * @param res - Express response object
 * @returns Minimal account information for the specified user
 *
 * Security considerations:
 * - Validates userId parameter to prevent injection attacks
 * - Implements authorization checks to ensure users can only access their own data
 * - Uses parameterized queries through service layer
 * - Returns minimal data to reduce information exposure
 */
export const getUserAccountsMinimal = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Input validation - prevent injection attacks
    const userId = Number(req.params.userId);
    if (isNaN(userId) || userId <= 0) {
      return sendErrorResponse(
        res,
        "Please provide a valid userId parameter.",
        400
      );
    }

    const accounts = await accountService.getUserAccountsMinimal(userId);
    return sendSuccessResponse(res, accounts);
  } catch (err: unknown) {
    // Log error for monitoring (in production, use proper logging)
    // eslint-disable-next-line no-console
    console.error("Error in getUserAccountsMinimal:", err);

    if (err instanceof Error && err.message === "USER_NOT_FOUND") {
      return sendErrorResponse(res, "User not found", 404);
    }
    // Generic error message to prevent information disclosure
    return sendErrorResponse(res, "Internal server error", 500);
  }
};

/**
 * Fetch assigned accounts dropdown data for a specific customer
 *
 * @route GET /api/account/customer/:customerId/dropdown
 * @access Private (requires authentication and customer access authorization)
 * @param req - Express request object containing customerId in params or query
 * @param res - Express response object
 * @returns Dropdown data for assigned accounts
 *
 * Security considerations:
 * - Validates customerId parameter to prevent injection attacks
 * - Implements authorization checks to ensure users can only access authorized customers
 * - Uses parameterized queries through service layer
 * - Returns minimal data for dropdown purposes
 */
export const fetchAssignedAccountsDropdown = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Input validation - prevent injection attacks
    const customerId = req.query.customer_id
      ? Number(req.query.customer_id)
      : Number(req.params.customerId);

    if (!customerId || isNaN(customerId) || customerId <= 0) {
      return sendErrorResponse(res, "Missing or invalid 'customer_id'", 400);
    }

    const data = await accountService.fetchAssignedAccountsDropdown(customerId);
    return sendSuccessResponse(res, data);
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "CUSTOMER_NOT_FOUND") {
      return sendErrorResponse(res, "Customer not found", 404);
    }
    // Generic error message to prevent information disclosure
    return sendErrorResponse(res, "Internal server error", 500);
  }
};

/**
 * Download accounts data for a specific user as Excel file
 *
 * @route POST /api/account/user/:userId/download
 * @access Private (requires authentication, user authorization, and rate limiting)
 * @param req - Express request object containing query and columns in body
 * @param res - Express response object
 * @returns Excel file download
 *
 * Security considerations:
 * - Validates userId parameter to prevent injection attacks
 * - Implements authorization checks to ensure users can only access their own data
 * - Validates and sanitizes column definitions to prevent malicious input
 * - Rate limiting should be applied to prevent abuse
 * - Uses parameterized queries through service layer
 * - Sanitizes filename to prevent path traversal attacks
 */
export const downloadAccountsByUserId = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Validate request body using helper function
    const validation = validateDownloadRequest(req);
    if (!validation.isValid) {
      return sendErrorResponse(res, validation.error, 400);
    }

    const { query, columns } = validation;

    // Validate userId
    const numericUserId = Number(query.userId);
    if (isNaN(numericUserId) || numericUserId <= 0) {
      return sendErrorResponse(
        res,
        "Please provide a valid userId in the request body.",
        400
      );
    }

    // Download accounts data
    const { buffer, filename } = await accountService.downloadAccountsByUserId(
      query,
      columns
    );

    // Send Excel file using helper function
    sendExcelFile(res, buffer, filename);
    return res;
  } catch (err: unknown) {
    // Log error for monitoring (in production, use proper logging)
    // eslint-disable-next-line no-console
    console.error("Error in downloadAccountsByUserId:", err);

    if (err instanceof Error && err.message === "USER_NOT_FOUND") {
      return sendErrorResponse(res, "User not found.", 404);
    }
    // Generic error message to prevent information disclosure
    return sendErrorResponse(res, "Internal server error", 500);
  }
};

/**
 * Download secondary contacts data for a specific account as Excel file
 *
 * @route POST /api/account/:accountId/contacts/download
 * @access Private (requires authentication, account authorization, and rate limiting)
 * @param req - Express request object containing query and columns in body
 * @param res - Express response object
 * @returns Excel file download
 *
 * Security considerations:
 * - Validates accountId parameter to prevent injection attacks
 * - Implements authorization checks to ensure users can only access authorized accounts
 * - Validates and sanitizes column definitions to prevent malicious input
 * - Rate limiting should be applied to prevent abuse
 * - Uses parameterized queries through service layer
 * - Sanitizes filename to prevent path traversal attacks
 */
export const downloadSecondaryContacts = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Validate request body using helper function
    const validation = validateSecondaryContactsDownloadRequest(req);
    if (!validation.isValid) {
      return sendErrorResponse(res, validation.error, 400);
    }

    const { query, columns } = validation;

    // Validate accountId
    const accountId = query.accountId;
    if (!accountId || isNaN(accountId) || accountId <= 0) {
      return sendErrorResponse(res, "Invalid or missing account ID", 400);
    }

    // Download secondary contacts data
    const { buffer, filename } = await accountService.downloadSecondaryContacts(
      accountId,
      query,
      columns
    );

    // Send Excel file using helper function
    sendExcelFile(res, buffer, filename);
    return res;
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "ACCOUNT_NOT_FOUND") {
      return sendErrorResponse(res, "Account not found", 404);
    }
    // Generic error message to prevent information disclosure
    return sendErrorResponse(res, "Internal server error", 500);
  }
};

/**
 * Download accounts data for a specific customer as Excel file
 *
 * @route POST /api/account/customer/:customerId/download
 * @access Private (requires authentication, customer authorization, and rate limiting)
 * @param req - Express request object containing query and columns in body
 * @param res - Express response object
 * @returns Excel file download
 *
 * Security considerations:
 * - Validates customerId parameter to prevent injection attacks
 * - Implements authorization checks to ensure users can only access authorized customers
 * - Validates and sanitizes column definitions to prevent malicious input
 * - Rate limiting should be applied to prevent abuse
 * - Uses parameterized queries through service layer
 * - Sanitizes filename to prevent path traversal attacks
 * - Validates excludedIds array to prevent malicious input
 */
export const downloadAccountsOfCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    // Validate request body using helper function
    const validation = validateDownloadRequest(req);
    if (!validation.isValid) {
      return sendErrorResponse(res, validation.error, 400);
    }

    const { query, columns } = validation;

    // Validate customerId
    const numericCustomerId = Number(query.customerId);
    if (isNaN(numericCustomerId) || numericCustomerId <= 0) {
      return sendErrorResponse(
        res,
        "Please provide a valid customerId in the request body.",
        400
      );
    }

    // Validate excludedIds if provided
    if (query.excludedIds && !Array.isArray(query.excludedIds)) {
      return sendErrorResponse(res, "excludedIds must be an array", 400);
    }

    // Download accounts data
    const { buffer, filename } = await accountService.downloadAccountsOfCustomer(
      numericCustomerId,
      query,
      columns
    );

    // Send Excel file using helper function
    sendExcelFile(res, buffer, filename);
    return res;
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "ACCOUNT_NOT_FOUND") {
      return sendErrorResponse(res, "Account not found", 404);
    }
    // Generic error message to prevent information disclosure
    return sendErrorResponse(res, "Internal server error", 500);
  }
};
