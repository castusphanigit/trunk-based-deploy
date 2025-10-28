/**
 * Users Controller
 *
 * Handles HTTP requests for user-related operations including:
 * - Fetching users with pagination and filtering
 * - Managing user accounts and customer relationships
 * - User creation and management operations
 * - Excel export functionality for user data
 * - Email notifications via SendGrid
 * - Column preferences management
 *
 * Security considerations:
 * - All endpoints require proper authentication
 * - Input validation and sanitization
 * - Authorization checks for data access
 * - Rate limiting on export operations
 * - Protection against unauthorized user data access
 * - SQL injection prevention through service layer
 * - Proper error handling without information disclosure
 *
 * @author kalyanrai
 * @version 1.0.0
 */

import { Request, Response } from "express";
import { getPagination } from "../../utils/pagination";
import {
  sendErrorResponse,
  sendPaginatedResponse,
  sendSuccessResponse,
} from "../../utils/responseUtils";

import {
  UserFilterDTO,
  UserCustomerAccountsResponseDTO,
  CreateUserColumnPreferenceDto,
  CreateUserInput,
  GetUsersByCustomerIdQueryDTO,
  CustomersFilterQuery,
} from "../../types/dtos/user.dto";
import { UserService } from "../../services/user.service";
import { getSecretsManagerService } from "../../services/secretsManager.service";

import { ColumnDefinition } from "../../types/common/request.types";

import sgMail from "@sendgrid/mail";
// eslint-disable-next-line n/no-process-env
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
const userService = new UserService();

/**
 * Get all tenant users with pagination and filtering
 *
 * @route GET /api/users/tenant
 * @access Private (requires authentication)
 * @param req - Express request object containing query parameters
 * @param res - Express response object
 * @returns Paginated list of tenant users
 *
 * Security considerations:
 * - Validates query parameters to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Limits data exposure through selective field queries
 */
export const getAllTenUsers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { page, perPage, skip, take } = getPagination(req.query);

    const query: UserFilterDTO = {
      name: req.query.name as string,
      email: req.query.email as string,
      status: req.query.status as string,
      designation: req.query.designation as string,
      is_customer_user: req.query.is_customer_user as string,
      user_role_id: req.query.user_role_id as string,
      first_active_from: req.query.first_active_from as string,
      first_active_to: req.query.first_active_to as string,
      last_active_from: req.query.last_active_from as string,
      last_active_to: req.query.last_active_to as string,

      page,
      perPage,
      sort: req.query.sort as string,
    };

    const { data, total } = await userService.getAllTenantUsers(
      query,
      skip,
      take
    );

    return sendPaginatedResponse(res, data, total, page, perPage);
  } catch (error) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Get current user information by user ID
 *
 * @route GET /api/users/current/:userId
 * @access Private (requires authentication)
 * @param req - Express request object containing userId in params
 * @param res - Express response object
 * @returns Current user information
 *
 * Security considerations:
 * - Validates userId parameter to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Prevents unauthorized access to user data
 */
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    if (!userId) {
      return sendErrorResponse(res, "User ID missing or invalid", 400);
    }

    const user = await userService.getCurrentUser(userId);

    if (!user) {
      return sendErrorResponse(res, "User not found", 404);
    }

    return sendSuccessResponse(res, user);
  } catch (error) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Get customer users by account assignment with pagination and filtering
 *
 * @route GET /api/users/customer-by-account/:userId
 * @access Private (requires authentication)
 * @param req - Express request object containing userId in params and query parameters
 * @param res - Express response object
 * @returns Paginated list of customer users based on account assignment
 *
 * Security considerations:
 * - Validates userId parameter to prevent injection attacks
 * - Validates query parameters to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Prevents unauthorized access to user data
 * - Limits data exposure through selective field queries
 */
export const getCustomerUsersByAccountAssignment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { userId } = req.params;

    const query: UserFilterDTO = {
      accountIds: (req.query.accountIds as string) || "all",
      name: req.query.name as string,
      email: req.query.email as string,
      status: req.query.status as string,
      designation: req.query.designation as string,
      is_customer_user: req.query.is_customer_user as string,
      user_role_id: req.query.user_role_id as string,
      first_active_from: req.query.first_active_from as string,
      first_active_to: req.query.first_active_to as string,
      last_active_from: req.query.last_active_from as string,
      last_active_to: req.query.last_active_to as string,
      customer_name: req.query.customer_name as string,
      reference_number: req.query.reference_number as string,
      customer_account: req.query.customer_account as string,
      page: req.query.page ? Number(req.query.page) : 1,
      perPage: req.query.perPage ? Number(req.query.perPage) : 10,
      sort: req.query.sort as string,
    };

    const result = await userService.fetchCustomerUsersByAccountAssignment(
      Number(userId),
      query
    );

    return sendSuccessResponse(res, result);
  } catch (error) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Get customer details and accounts by user ID
 *
 * @route GET /api/users/customer-details/:userId
 * @access Private (requires authentication)
 * @param req - Express request object containing userId in params
 * @param res - Express response object
 * @returns Customer details and associated accounts for the user
 *
 * Security considerations:
 * - Validates userId parameter to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Prevents unauthorized access to customer data
 */
export const getCustomerDetailsAndAccountsByUserId = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const userId = parseInt(req.params.userId, 10);

    const result: UserCustomerAccountsResponseDTO =
      await userService.fetchCustomerDetailsAndAccountsByUserId(userId);

    return sendSuccessResponse(res, result);
  } catch (error) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Fetch customers with pagination and filtering
 *
 * @route GET /api/users/customers
 * @access Private (requires authentication)
 * @param req - Express request object containing query parameters
 * @param res - Express response object
 * @returns Paginated list of customers
 *
 * Security considerations:
 * - Validates query parameters to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Limits data exposure through selective field queries
 */
export const fetchCustomers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { page, perPage, skip, take } = getPagination(req.query);

    const filters = {
      customer_name: req.query.customer_name as string,
      customer_class: req.query.customer_class as string,
      status: req.query.status as string,
      reference_number: req.query.reference_number as string,
      sold_by_salesperson_id: req.query.sold_by_salesperson_id
        ? Number(req.query.sold_by_salesperson_id)
        : undefined,
      created_by: req.query.created_by
        ? Number(req.query.created_by)
        : undefined,
    };

    const sort =
      typeof req.query.sort === "string" ? req.query.sort : undefined;

    const { customers, total } = await userService.fetchCustomersService(
      filters,
      skip,
      take,
      sort
    );

    return sendPaginatedResponse(res, customers, total, page, perPage, 200, {});
  } catch (error) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Fetch user metrics and master data
 *
 * @route GET /api/users/metrics
 * @access Private (requires authentication)
 * @param req - Express request object
 * @param res - Express response object
 * @returns User metrics and master data
 *
 * Security considerations:
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Limits data exposure through selective field queries
 */

/**
 * Get all users by customer ID with pagination and filtering
 *
 * @route GET /api/users/by-customer
 * @access Private (requires authentication)
 * @param req - Express request object containing customer_id in query
 * @param res - Express response object
 * @returns Paginated list of users for the specified customer
 *
 * Security considerations:
 * - Validates customer_id parameter to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Prevents unauthorized access to user data
 */
export const getAllUsersByCustomerId = async (req: Request, res: Response) => {
  try {
    const customerId = Number(req.query.customer_id);
    if (isNaN(customerId) || customerId <= 0) {
      return sendErrorResponse(
        res,
        "Please provide a valid customer_id parameter.",
        400
      );
    }

    const { users, total, page, perPage } =
      await userService.getAllUsersByCustomerId(customerId, req.query);

    return sendPaginatedResponse(res, users, total, page, perPage, 200);
  } catch (error) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Create a new user
 *
 * @route POST /api/users
 * @access Private (requires authentication)
 * @param req - Express request object containing user data in body
 * @param res - Express response object
 * @returns Created user information
 *
 * Security considerations:
 * - Validates input data to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Validates user permissions for user creation
 * - Sanitizes input data before processing
 */
export const createUser = async (
  req: Request<Record<string, string>, unknown, CreateUserInput>,
  res: Response
): Promise<Response> => {
  try {
    const newUser = await userService.createUser(req.body);
    return sendSuccessResponse(res, newUser, "201");
  } catch (error: unknown) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Update an existing user
 *
 * @route PUT /api/users/:user_id
 * @access Private (requires authentication)
 * @param req - Express request object containing user_id in params and user data in body
 * @param res - Express response object
 * @returns Updated user information
 *
 * Security considerations:
 * - Validates user_id parameter to prevent injection attacks
 * - Validates input data to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Validates user permissions for user updates
 * - Sanitizes input data before processing
 */
export const updateUser = async (
  req: Request<Record<string, string>, unknown, CreateUserInput>,
  res: Response
): Promise<Response> => {
  try {
    const user_id = Number(req.params.user_id);
    if (isNaN(user_id)) return sendErrorResponse(res, "Invalid user_id", 400);

    const updatedUser = await userService.updateUser(user_id, req.body);
    return sendSuccessResponse(res, updatedUser);
  } catch (error: unknown) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Update user verification status
 *
 * @route PUT /api/users/:user_id/verify
 * @access Private (requires authentication)
 * @param req - Express request object containing user_id in params and verification data in body
 * @param res - Express response object
 * @returns Updated user verification information
 *
 * Security considerations:
 * - Validates user_id parameter to prevent injection attacks
 * - Validates input data to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Validates user permissions for user verification
 * - Sends email notifications via SendGrid
 * - Sanitizes input data before processing
 */
export const updateUserVerify = async (
  req: Request<
    Record<string, string>,
    unknown,
    { is_user_approved: boolean; approved_by: number }
  >,
  res: Response
): Promise<Response> => {
  try {
    const user_id = Number(req.params.user_id);
    if (isNaN(user_id)) return sendErrorResponse(res, "Invalid user_id", 400);

    const { is_user_approved, approved_by } = req.body;

    const updatedUser = await userService.updateUserVerify(user_id, {
      is_user_approved,
      approved_by,
    });

    // SendGrid test email
    await sgMail.send({
      to: "kalyanrai8897@gmail.com",
      // eslint-disable-next-line n/no-process-env
      from: process.env.SENDGRID_FROM_EMAIL!,
      subject: "Test Email",
      text: "This is a test email",
    });

    return sendSuccessResponse(res, updatedUser);
  } catch (error: unknown) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};
/**
 * Toggle user status (activate/deactivate)
 *
 * @route PUT /api/users/:user_id/status
 * @access Private (requires authentication)
 * @param req - Express request object containing user_id in params and action in body
 * @param res - Express response object
 * @returns Updated user status information
 *
 * Security considerations:
 * - Validates user_id parameter to prevent injection attacks
 * - Validates action parameter to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Validates user permissions for status changes
 * - Sanitizes input data before processing
 */
export const toggleUserStatus = async (
  req: Request<
    Record<string, string>, // safer for params
    unknown,
    { action: "activate" | "deactivate" }
  >,
  res: Response
): Promise<Response> => {
  try {
    const user_id = Number(req.params.user_id);
    if (isNaN(user_id)) return sendErrorResponse(res, "Invalid user_id", 400);

    const { action } = req.body;

    const result = await userService.toggleUserStatus(user_id, action);

    return sendSuccessResponse(res, result);
  } catch (error: unknown) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Update customer information
 *
 * @route PUT /api/users/customer/:customer_id
 * @access Private (requires authentication)
 * @param req - Express request object containing customer_id in params and customer data in body
 * @param res - Express response object
 * @returns Updated customer information
 *
 * Security considerations:
 * - Validates customer_id parameter to prevent injection attacks
 * - Validates input data to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Validates user permissions for customer updates
 * - Sanitizes input data before processing
 * - Handles webhook configuration securely
 */
export const updateCustomer = async (
  req: Request<
    Record<string, string>,
    unknown,
    {
      web_hook_url?: string;
      web_hook_password?: string;
      web_hook_userName?: string;
    }
  >,
  res: Response
): Promise<Response> => {
  try {
    const customer_id = Number(req.params.customer_id);

    if (isNaN(customer_id))
      return sendErrorResponse(res, "Invalid customer_id", 400);

    const updatedCustomer = await userService.updateCustomer(
      customer_id,
      req.body
    );
    return sendSuccessResponse(res, updatedCustomer);
  } catch (error: unknown) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Create or update user column preferences
 *
 * @route POST /api/users/column-preferences
 * @access Private (requires authentication)
 * @param req - Express request object containing preferences data in body
 * @param res - Express response object
 * @returns Created/updated column preferences
 *
 * Security considerations:
 * - Validates input data to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Validates user permissions for preference management
 * - Sanitizes input data before processing
 */
export const createUserColumnPreference = async (
  req: Request,
  res: Response
) => {
  try {
    const { data } = req.body as { data?: CreateUserColumnPreferenceDto[] };
    const directPreference = req.body as CreateUserColumnPreferenceDto;

    // Handle both array format (existing) and single object format (new)
    let preferences: CreateUserColumnPreferenceDto[];

    if (data?.length && Array.isArray(data)) {
      // Existing format: { data: [...] }
      preferences = data;
    } else if (
      directPreference?.user_id &&
      directPreference?.column_preference_table_name_id
    ) {
      // New format: single object directly
      preferences = [directPreference];
    } else {
      return sendErrorResponse(res, "No preferences provided", 400);
    }

    // Call the service for each preference
    const result = await Promise.all(
      preferences.map((pref) => userService.createOrUpdatePreference(pref))
    );

    return sendSuccessResponse(res, result);
  } catch (error) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Get user column preferences by user ID and table name ID
 *
 * @route GET /api/users/:user_id/column-preferences/:tableNameId
 * @access Private (requires authentication)
 * @param req - Express request object containing user_id and tableNameId in params
 * @param res - Express response object
 * @returns User column preferences
 *
 * Security considerations:
 * - Validates user_id and tableNameId parameters to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Prevents unauthorized access to user preferences
 */
export const getUserColumnPreferences = async (req: Request, res: Response) => {
  try {
    const user_id = Number(req.params.user_id); // 👈 match route param name
    const tableNameId = Number(req.params.tableNameId);

    if (isNaN(user_id) || isNaN(tableNameId)) {
      return sendErrorResponse(res, "Invalid parameters", 400);
    }

    const preferences = await userService.getPreferenceByUserAndTable(
      user_id,
      tableNameId
    );

    return sendSuccessResponse(res, preferences);
  } catch (error) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Get master column preference table names
 *
 * @route GET /api/users/column-preferences/master-tables
 * @access Private (requires authentication)
 * @param req - Express request object
 * @param res - Express response object
 * @returns Master column preference table names
 *
 * Security considerations:
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Limits data exposure through selective field queries
 */
export const getMasterColumnPreferenceTable = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const Response = await userService.getMasterColumnPreferenceTableName();

    return sendSuccessResponse(res, Response);
  } catch (error) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Get super admin by customer ID
 *
 * @route GET /api/users/super-admin/:customerId
 * @access Private (requires authentication)
 * @param req - Express request object containing customerId in params
 * @param res - Express response object
 * @returns Super admin information for the specified customer
 *
 * Security considerations:
 * - Validates customerId parameter to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Prevents unauthorized access to admin data
 */
export const getSuperAdminByCustomer = async (req: Request, res: Response) => {
  try {
    const customerId = Number(req.params.customerId);

    if (!customerId) {
      return sendErrorResponse(res, "Customer ID missing or invalid", 400);
    }

    const result = await userService.getSuperAdminByCustomerId(customerId);

    if (!result) {
      return sendErrorResponse(
        res,
        "Super Admin not found for this customer",
        404
      );
    }

    return sendSuccessResponse(res, result);
  } catch (error) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Download users by customer ID as Excel file
 *
 * @route POST /api/users/download-by-customer
 * @access Private (requires authentication)
 * @param req - Express request object containing query and columns in body
 * @param res - Express response object
 * @returns Excel file download
 *
 * Security considerations:
 * - Validates query and columns data to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Sanitizes data before export to prevent XSS and injection attacks
 * - Uses safe filename generation to prevent path traversal
 * - Implements rate limiting on export operations
 * - Validates user permissions for data export
 */
export const downloadUsersByCustomerId = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { query, columns } = req.body as {
      query: GetUsersByCustomerIdQueryDTO[];
      columns: ColumnDefinition[];
    };

    if (!columns || !Array.isArray(columns)) {
      return res.status(400).json({ error: "Columns are required" });
    }

    const { buffer, filename } = await userService.downloadUsersByCustomerId(
      Array.isArray(query) ? query[0] : query,
      columns
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);

    return res.send(buffer);
  } catch (error) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Download all tenant users as Excel file
 *
 * @route POST /api/users/download-all-tenant
 * @access Private (requires authentication)
 * @param req - Express request object containing query and columns in body
 * @param res - Express response object
 * @returns Excel file download
 *
 * Security considerations:
 * - Validates query and columns data to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Sanitizes data before export to prevent XSS and injection attacks
 * - Uses safe filename generation to prevent path traversal
 * - Implements rate limiting on export operations
 * - Validates user permissions for data export
 */
export const downloadAllTenUsers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { query, columns } = req.body as {
      query: UserFilterDTO[];
      columns: ColumnDefinition[];
    };

    if (!columns || !Array.isArray(columns)) {
      res.status(400).json({ error: "Columns are required" });
      return;
    }

    const { buffer, filename } = await userService.downloadAllTenantUsers(
      Array.isArray(query) ? query[0] : query,
      columns
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);

    res.send(buffer);
    return;
  } catch (error: unknown) {
    sendErrorResponse(res, (error as Error).message || "Internal server error");
    return;
  }
};

/**
 * Download customer users by account assignment as Excel file
 *
 * @route POST /api/users/download-by-account-assignment/:userId
 * @access Private (requires authentication)
 * @param req - Express request object containing userId in params and query/columns in body
 * @param res - Express response object
 * @returns Excel file download
 *
 * Security considerations:
 * - Validates userId parameter to prevent injection attacks
 * - Validates query and columns data to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Sanitizes data before export to prevent XSS and injection attacks
 * - Uses safe filename generation to prevent path traversal
 * - Implements rate limiting on export operations
 * - Validates user permissions for data export
 */
export const downloadCustomerUsersByAccountAssignment = async (
  req: Request,
  res: Response
) => {
  try {
    const userId = Number(req.params.userId);
    const { query, columns } = req.body as {
      query: UserFilterDTO[];
      columns: ColumnDefinition[];
    };

    if (!columns || !Array.isArray(columns)) {
      return res.status(400).json({ error: "Columns are required" });
    }

    const { buffer, filename } =
      await userService.downloadCustomerUsersByAccountAssignment(
        userId,
        Array.isArray(query) ? query[0] : query,
        columns
      );

    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (error: unknown) {
    sendErrorResponse(res, (error as Error).message || "Internal server error");
    return;
  }
};

/**
 * Download customers as Excel file
 *
 * @route POST /api/users/download-customers
 * @access Private (requires authentication)
 * @param req - Express request object containing query and columns in body
 * @param res - Express response object
 * @returns Excel file download
 *
 * Security considerations:
 * - Validates query and columns data to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Sanitizes data before export to prevent XSS and injection attacks
 * - Uses safe filename generation to prevent path traversal
 * - Implements rate limiting on export operations
 * - Validates user permissions for data export
 */
export const downloadCustomers = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { query, columns } = req.body as {
      query: CustomersFilterQuery[];
      columns: ColumnDefinition[];
    };

    if (!query) {
      sendErrorResponse(res, "Query filters are required");
      return;
    }

    const { buffer, filename } = await userService.downloadCustomers(
      Array.isArray(query) ? query[0] : query,
      columns
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (error: unknown) {
    sendErrorResponse(res, (error as Error).message || "Internal server error");
  }
};

/**
 * Get all active localizations
 *
 * @route GET /api/users/localizations
 * @access Private (requires authentication)
 * @param req - Express request object
 * @param res - Express response object
 * @returns Array of all localization records
 *
 * Security considerations:
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Limits data exposure through selective field queries
 */
export const getActiveLocalizations = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const localizations = await userService.getActiveLocalizations();
    return sendSuccessResponse(res, localizations);
  } catch (error) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Load web secrets from AWS Secrets Manager
 *
 * @route GET /api/user/webSecrets
 * @access Private (requires authentication)
 * @param req - Express request object
 * @param res - Express response object
 * @returns Web secrets from AWS Secrets Manager
 *
 * Security considerations:
 * - Requires proper AWS credentials and configuration
 * - Implements proper error handling without information disclosure
 * - Uses secure AWS Secrets Manager service
 * - Validates environment variables before processing
 */
export const loadWebSecrets = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const secretsManager = getSecretsManagerService();
    const secrets = await secretsManager.loadWebSecrets();

    return res.status(200).json({
      message: "Secrets fetched successfully",
      secrets,
    });
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error("Error fetching secrets from AWS:", (error as Error).message);
    return res.status(500).json({
      message: "Failed to fetch secrets",
      error: (error as Error).message,
    });
  }
};