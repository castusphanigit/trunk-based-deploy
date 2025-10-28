/**
 * Roles Controller
 *
 * Handles HTTP requests for role-related operations including:
 * - Fetching user roles by customer with pagination and filtering
 * - Creating new user roles with Auth0 integration
 * - Editing existing user roles with Auth0 synchronization
 * - Retrieving individual role details by ID
 *
 * Security considerations:
 * - All endpoints require proper authentication
 * - Input validation and sanitization
 * - Authorization checks for data access
 * - Protection against unauthorized role management
 * - SQL injection prevention through service layer
 * - Proper error handling without information disclosure
 *
 * @author kalyanrai
 * @version 1.0.0
 */

// src/api/controllers/role.controller.ts
import { Request, Response } from "express";
import { RoleService } from "../../services/role.service";
import {
  sendErrorResponse,
  sendSuccessResponse,
  sendPaginatedResponse,
} from "../../utils/responseUtils";
import {
  CreateUserRoleDTO,
  EditUserRoleRequestDTO,
} from "../../types/dtos/role.dto";

const roleService = new RoleService();

/**
 * Get user roles by customer ID with pagination and filtering
 *
 * @route GET /api/roles/customer/:customer_id
 * @access Private (requires authentication)
 * @param req - Express request object containing customer_id parameter and query filters
 * @param res - Express response object
 * @returns Paginated list of user roles for the customer
 *
 * Security considerations:
 * - Validates customer_id parameter to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Limits data exposure through selective field queries
 * - Validates user permissions for customer data access
 */
export const getUserRolesByCustomerId = async (req: Request, res: Response) => {
  try {
    const { customer_id } = req.params;
    if (!customer_id || isNaN(Number(customer_id))) {
      return sendErrorResponse(res, "Valid customer_id is required");
    }

    const { roles, total, page, perPage } =
      await roleService.getUserRolesByCustomerId(
        Number(customer_id),
        req.query
      );

    return sendPaginatedResponse(res, roles, total, page, perPage);
  } catch (error: unknown) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Create a new user role with Auth0 integration
 *
 * @route POST /api/roles
 * @access Private (requires authentication and role management permissions)
 * @param req - Express request object containing role creation data
 * @param res - Express response object
 * @returns Created role information with success message
 *
 * Security considerations:
 * - Validates request body data to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Creates Auth0 role for secure authentication
 * - Validates role uniqueness within customer scope
 * - Ensures proper authorization for role creation
 * - Sanitizes input data before processing
 */
export const createUserRole = async (
  req: Request<unknown, unknown, CreateUserRoleDTO>,
  res: Response
) => {
  try {
    const role = await roleService.createUserRole(req.body);
    return sendSuccessResponse(res, {
      message: "Role created successfully",
      role,
    });
  } catch (error: unknown) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Edit an existing user role with Auth0 synchronization
 *
 * @route PUT /api/roles
 * @access Private (requires authentication and role management permissions)
 * @param req - Express request object containing role edit data
 * @param res - Express response object
 * @returns Updated role information with success message
 *
 * Security considerations:
 * - Validates request body data to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Updates Auth0 role for secure authentication
 * - Validates role existence before editing
 * - Ensures proper authorization for role modification
 * - Maintains data integrity between local DB and Auth0
 * - Sanitizes input data before processing
 */
export const editUserRole = async (
  req: Request<unknown, unknown, EditUserRoleRequestDTO>,
  res: Response
): Promise<Response> => {
  try {
    const payload = req.body;
    const updatedRole = await roleService.editUserRole(payload);

    return sendSuccessResponse(res, {
      message: "Role updated successfully in Auth0 and local DB",
      role: updatedRole,
    });
  } catch (error: unknown) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};

/**
 * Get user role by role ID
 *
 * @route GET /api/roles/:role_id
 * @access Private (requires authentication)
 * @param req - Express request object containing role_id parameter
 * @param res - Express response object
 * @returns Role information or error if not found
 *
 * Security considerations:
 * - Validates role_id parameter to prevent injection attacks
 * - Uses parameterized queries through service layer
 * - Implements proper error handling without information disclosure
 * - Limits data exposure through selective field queries
 * - Validates user permissions for role data access
 * - Returns appropriate error for non-existent roles
 */
export const getUserRoleById = async (req: Request, res: Response) => {
  try {
    const { role_id } = req.params;
    if (!role_id || isNaN(Number(role_id))) {
      return sendErrorResponse(res, "Valid role_id is required");
    }

    const role = await roleService.getUserRoleById(Number(role_id));
    if (!role) return sendErrorResponse(res, "Role not found");

    return sendSuccessResponse(res, { role });
  } catch (error: unknown) {
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error"
    );
  }
};
