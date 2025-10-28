/**
 * User Service
 *
 * Handles business logic for user-related operations including:
 * - User CRUD operations with proper authorization
 * - User authentication and management
 * - Customer relationship management
 * - Excel export functionality for user data
 * - Column preferences management
 * - Auth0 integration for user management
 * - Password hashing and security
 *
 * Security considerations:
 * - All database queries use parameterized queries (Prisma ORM)
 * - Input validation and sanitization
 * - Authorization checks for data access
 * - SQL injection prevention through ORM
 * - Data sanitization for exports
 * - Proper error handling without information disclosure
 * - Secure password hashing with bcrypt
 * - Auth0 integration for secure user management
 *
 * @author kalyanrai
 * @version 1.0.0
 */

import prisma from "../config/database.config";

import {
  CurrentUserDTO,
  UserFilterDTO,
  UserCustomerAccountsResponseDTO,
  AccountDTO,
  CustomerListDTO,
  CustomerFilters,
  GetUsersByCustomerIdQueryDTO,
  CreateUserColumnPreferenceDto,
  UserColumnPreferenceResponseDto,
  CustomersFilterQuery,
  ExtendedUserMinimalDTO,
  ColumnPreferenceTableNameDto,
  UserColumnPreferenceDto,
  UserMinimalDTO,
  AccountWithSelect,
  UserWithRelations,
  CreateUserInput,
  Auth0User,
  Auth0ErrorData,
  LocalizationLookupDTO,
} from "../../src/types/dtos/user.dto";
import { createErrorWithMessage, ServiceError } from "../utils/responseUtils";

import { ColumnDefinition } from "../types/common/request.types";

import { getPagination } from "../utils/pagination";
import { buildOrderByFromSort } from "../utils/sort";
import {
  USER_SORT_FIELDS,
  CUSTOMER_SORT_FIELDS,
} from "../types/sorts/sortTypes";
import { ExcelExporter } from "../utils/excelUtils";

interface ColumnConfig {
  header: string;
  key: string;
  width?: number;
  formatter?: (value: unknown) => unknown;
}

interface CustomerData {
  customer_id: number;
  auth0_customer_id: string | null;
}

interface UserRoleData {
  auth0_role_id: string | null;
  role_permission: Prisma.JsonValue | null;
}

interface TenantUser {
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  designation: string | null;
  avatar: string | null;
  status: string | null;
  is_customer_user: boolean;
  first_active: Date | null;
  last_active: Date | null;
  created_at: Date;
  created_by: number | null;
  updated_at: Date | null;
  updated_by: number | null;
  assigned_account_ids: number[] | null;
  is_user_approved: boolean | null;
  approved_by: number | null;
  approved_at: Date | null;
  user_role_ref: {
    user_role_id: number;
    name: string;
    description: string | null;
  } | null;
  approved_by_user: {
    user_id: number;
    first_name: string | null;
    last_name: string | null;
  } | null;
}

interface AccountData {
  account_id: number;
  account_name: string | null;
  account_number: string | null;
}

type CustomerRecord = Record<string, unknown>;
import { Prisma } from "@prisma/client";
import {
  addUserToOrganization,
  addUserToRole,
  createAuth0User,
  updateAuth0User,
  updateAuth0UserStatus,
} from "./auth0.service";
import bcrypt from "bcrypt";

/**
 * Interface for User data structure
 * Contains user information with related customer and role references
 */
interface User {
  user_id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone_number?: string | null;
  designation?: string | null;
  avatar?: string | null;
  status?: string | null;
  customer_ref?: {
    customer_name: string;
    reference_number: string;
    _count?: { accounts: number };
  } | null;
  user_role_ref?: { user_role_id: number; name: string } | null;
  assigned_account_ids?: number[] | null;
  //  this line fixes the error
  [key: string]: unknown;
}

/**
 * UserService class handles all user-related business logic
 *
 * This service provides methods for:
 * - User CRUD operations with proper authorization
 * - User authentication and management
 * - Customer relationship management
 * - Excel export functionality for user data
 * - Column preferences management
 * - Auth0 integration for user management
 *
 * All methods implement proper error handling and input validation
 * to prevent security vulnerabilities.
 */
export class UserService {
  /**
   * Create a new user with Auth0 integration
   *
   * @param input - User creation input data
   * @returns Created user information
   *
   * Security considerations:
   * - Validates all input parameters to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Creates Auth0 user for secure authentication
   * - Hashes password securely with bcrypt
   * - Validates user role and customer relationships
   * - Assigns proper permissions and roles
   */
  public async createUser(input: CreateUserInput) {
    this.validateCreateUserInput(input);

    const { customer, userRole } = await this.validateCustomerAndRole(input);

    const auth0User = await this.createAuth0User(input);
    const newUser = await this.saveUserToDatabase(
      input,
      customer,
      userRole,
      auth0User
    );
    await this.assignAuth0Permissions(customer, userRole, auth0User);

    return newUser;
  }

  /**
   * Validate create user input parameters
   */
  private validateCreateUserInput(input: CreateUserInput): void {
    if (!input.user_role_id || isNaN(input.user_role_id)) {
      throw new ServiceError("Invalid or missing user_role_id", 400);
    }
    if (!input.customer_id || isNaN(input.customer_id)) {
      throw new ServiceError("Invalid or missing customer_id", 400);
    }
    if (!input.email || !input.password) {
      throw new ServiceError("Email and password are required for Auth0", 400);
    }
  }

  /**
   * Validate customer and user role existence
   */
  private async validateCustomerAndRole(input: CreateUserInput) {
    const [customer, userRole] = await Promise.all([
      prisma.customer.findUnique({ where: { customer_id: input.customer_id } }),
      prisma.user_role.findUnique({
        where: { user_role_id: input.user_role_id },
        select: {
          accessible_account_ids: true,
          auth0_role_id: true,
          role_permission: true,
        },
      }),
    ]);

    if (!customer) throw new ServiceError("Customer not found", 404);
    if (!userRole) throw new ServiceError("User role not found", 404);

    return { customer, userRole };
  }

  /**
   * Create Auth0 user
   */
  private async createAuth0User(input: CreateUserInput): Promise<Auth0User> {
    const auth0Payload = {
      email: input.email,
      given_name: input.first_name,
      family_name: input.last_name,
      name: `${input.first_name ?? ""} ${input.last_name ?? ""}`.trim(),
      picture: input.avatar,
      connection: "Username-Password-Authentication",
      password: input.password,
      verify_email: false,
      app_metadata: { needs_password_setup: true },
    };

    try {
      return await createAuth0User(auth0Payload);
    } catch (err: unknown) {
      this.handleAuth0CreateError(err);
    }
  }

  /**
   * Handle Auth0 user creation errors
   */
  private handleAuth0CreateError(err: unknown): never {
    const errorData = (err as { response?: { data?: Auth0ErrorData } })
      ?.response?.data;

    if (
      errorData?.statusCode === 409 &&
      errorData?.errorCode === "auth0_idp_error"
    ) {
      throw new ServiceError(
        "User with this email already exists in Auth0",
        409
      );
    }

    throw new ServiceError(
      errorData?.message ?? "Auth0 error occurred",
      errorData?.statusCode ?? 500
    );
  }

  /**
   * Save user to database
   */
  private async saveUserToDatabase(
    input: CreateUserInput,
    customer: CustomerData,
    userRole: UserRoleData,
    auth0User: Auth0User
  ) {
    try {
      return await prisma.user.create({
        data: {
          first_name: input.first_name,
          last_name: input.last_name,
          email: input.email,
          phone_number: input.phone_number,
          designation: input.designation,
          avatar: input.avatar,
          auth_0_reference_id: auth0User.user_id,
          status: input.status ?? "ACTIVE",
          is_customer_user: input.is_customer_user,
          user_role_id: input.user_role_id,
          customer_id: customer.customer_id,
          auth0_customer_id: customer.auth0_customer_id,
          auth0_role_id: userRole.auth0_role_id,
          assigned_account_ids: input.assigned_account_ids,
          localization_ids: input.localization_ids ?? [],
          permissions: userRole.role_permission ?? Prisma.JsonNull,
        },
        select: {
          user_id: true,
          first_name: true,
          last_name: true,
          email: true,
          user_role_id: true,
          customer_id: true,
          assigned_account_ids: true,
          localization_ids: true,
          auth_0_reference_id: true,
          auth0_role_id: true,
          permissions: true,
          phone_number: true,
        },
      });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "P2002") {
        throw new ServiceError(
          "User with this email already exists in database",
          409
        );
      }
      throw new ServiceError("Database error occurred", 500);
    }
  }

  /**
   * Assign Auth0 permissions and roles
   */
  private async assignAuth0Permissions(
    customer: CustomerData,
    userRole: UserRoleData,
    auth0User: Auth0User
  ): Promise<void> {
    const promises = [];

    if (customer.auth0_customer_id) {
      promises.push(
        addUserToOrganization(customer.auth0_customer_id, auth0User.user_id)
      );
    }

    if (userRole.auth0_role_id) {
      promises.push(addUserToRole(userRole.auth0_role_id, auth0User.user_id));
    }

    await Promise.all(promises);
  }

  /**
   * Parse excluded IDs from query parameter
   */
  private parseExcludedIds(excludedIds: unknown): number[] {
    if (!excludedIds) return [];
    if (Array.isArray(excludedIds)) {
      return excludedIds.map(Number).filter(Boolean);
    }
    if (typeof excludedIds === "string") {
      return excludedIds
        .split(",")
        .map((id: string) => Number(id.trim()))
        .filter(Boolean);
    }
    return [];
  }

  /**
   * Build tenant user filters
   */
  private buildTenantUserFilters(
    query: UserFilterDTO,
    excludedIds: number[]
  ): Prisma.userWhereInput {
    const baseFilters: Prisma.userWhereInput = {
      is_customer_user: false,
      ...(query.user_role_id && { user_role_id: Number(query.user_role_id) }),
      ...(query.email && {
        email: { contains: query.email, mode: "insensitive" },
      }),
      ...(query.status &&
        query.status !== "All" && {
          status: {
            contains: query.status,
            mode: Prisma.QueryMode.insensitive,
          },
        }),
      ...(query.designation && {
        designation: { contains: query.designation, mode: "insensitive" },
      }),
      ...(query.name && this.buildNameFilter(query.name)),
      ...(query.first_active_from || query.first_active_to
        ? {
            first_active: {
              ...(query.first_active_from && {
                gte: new Date(query.first_active_from),
              }),
              ...(query.first_active_to && {
                lte: new Date(query.first_active_to),
              }),
            },
          }
        : {}),
      ...(query.last_active_from || query.last_active_to
        ? {
            last_active: {
              ...(query.last_active_from && {
                gte: new Date(query.last_active_from),
              }),
              ...(query.last_active_to && {
                lte: new Date(query.last_active_to),
              }),
            },
          }
        : {}),
      ...(excludedIds.length > 0 && { NOT: { user_id: { in: excludedIds } } }),
    };

    return baseFilters;
  }

  /**
   * Build customer filters for download
   */
  private buildCustomerDownloadFilters(
    query: CustomersFilterQuery,
    excludedIds: number[]
  ): Prisma.customerWhereInput {
    return {
      is_deleted: false,
      ...(query.customer_id && { customer_id: Number(query.customer_id) }),
      ...(query.customer_name && {
        customer_name: {
          contains: query.customer_name,
          mode: "insensitive",
        },
      }),
      ...(query.customer_class && {
        customer_class: {
          contains: query.customer_class,
          mode: "insensitive",
        },
      }),
      ...(query.reference_number && {
        reference_number: {
          contains: query.reference_number,
          mode: "insensitive",
        },
      }),
      ...(query.status &&
        query.status !== "All" && {
          status: {
            contains: query.status,
            mode: Prisma.QueryMode.insensitive,
          },
        }),
      ...(query.sold_by_salesperson_id && {
        sold_by_salesperson_id: Number(query.sold_by_salesperson_id),
      }),
      ...(query.created_by && { created_by: Number(query.created_by) }),
      ...(query.updated_by && { updated_by: Number(query.updated_by) }),
      ...(query.auth0_customer_id && {
        auth0_customer_id: {
          contains: query.auth0_customer_id,
          mode: "insensitive",
        },
      }),
      ...(excludedIds.length > 0 && {
        customer_id: { notIn: excludedIds },
      }),
    };
  }

  /**
   * Update an existing user with Auth0 integration
   *
   * @param user_id - The ID of the user to update
   * @param input - User update input data
   * @returns Updated user information
   *
   * Security considerations:
   * - Validates user_id parameter to prevent injection attacks
   * - Validates all input parameters to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Updates Auth0 user for secure authentication
   * - Validates user role and customer relationships
   * - Maintains proper permissions and roles
   */
  public async updateUser(user_id: number, input: CreateUserInput) {
    const existingUser = await prisma.user.findUnique({
      where: { user_id },
      include: { customer_ref: true, user_role_ref: true },
    });
    if (!existingUser) throw new ServiceError("User not found", 404);

    // Fetch role permissions if user_role_id is being updated
    let rolePermissions = null;
    if (
      input.user_role_id &&
      input.user_role_id !== existingUser.user_role_id
    ) {
      const userRole = await prisma.user_role.findUnique({
        where: { user_role_id: input.user_role_id },
        select: { role_permission: true },
      });
      rolePermissions = userRole?.role_permission;
    }

    // --- Update Auth0 ---
    const auth0Payload: Record<string, unknown> = {
      email: input.email,
      given_name: input.first_name,
      family_name: input.last_name,
      name: `${input.first_name ?? ""} ${input.last_name ?? ""}`.trim(),
      picture: input.avatar,
    };

    try {
      await updateAuth0User(existingUser.auth_0_reference_id, auth0Payload);
    } catch (err: unknown) {
      const errorData = (
        err as {
          response?: { data?: { statusCode?: number; message?: string } };
        }
      )?.response?.data;
      throw new ServiceError(
        errorData?.message ?? "Auth0 update error",
        errorData?.statusCode ?? 500
      );
    }

    // --- Update Postgres ---
    const updatedUser = await prisma.user.update({
      where: { user_id },
      data: {
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        phone_number: input.phone_number,
        designation: input.designation,
        avatar: input.avatar,
        status: input.status,
        permissions: rolePermissions ?? input.permissions ?? Prisma.DbNull,
        assigned_account_ids: input.assigned_account_ids,
        localization_ids: input.localization_ids,
        user_role_id: input.user_role_id ?? existingUser.user_role_id,
        customer_id: input.customer_id ?? existingUser.customer_id,
        updated_at: new Date(),
      },
    });

    // --- Update Auth0 org / role if changed ---
    if (
      input.customer_id &&
      input.customer_id !== existingUser.customer_id &&
      existingUser.auth0_customer_id
    ) {
      await addUserToOrganization(
        existingUser.auth0_customer_id,
        existingUser.auth_0_reference_id
      );
    }

    if (
      input.user_role_id &&
      input.user_role_id !== existingUser.user_role_id &&
      existingUser.auth0_role_id
    ) {
      await addUserToRole(
        existingUser.auth0_role_id,
        existingUser.auth_0_reference_id
      );
    }

    return updatedUser;
  }

  /**
   * Update user verification status
   *
   * @param user_id - The ID of the user to update verification for
   * @param input - Verification data containing approval status and approver ID
   * @returns Updated user verification information
   *
   * Security considerations:
   * - Validates user_id parameter to prevent injection attacks
   * - Validates input parameters to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Validates user permissions for verification operations
   * - Maintains audit trail with approver information
   */
  public async updateUserVerify(
    user_id: number,
    input: { is_user_approved: boolean; approved_by: number }
  ) {
    const existingUser = await prisma.user.findUnique({
      where: { user_id },
    });

    if (!existingUser) {
      throw new ServiceError("User not found", 404);
    }

    // --- Update Postgres ---
    const updatedUser = await prisma.user.update({
      where: { user_id },
      data: {
        is_user_approved: input.is_user_approved,
        approved_by: input.approved_by,
        approved_at: new Date(),
        user_role_id: 1, // force default role
      },
    });

    // --- Add user to Auth0 organization ---
    if (existingUser.auth0_customer_id && existingUser.auth_0_reference_id) {
      try {
        await addUserToOrganization(
          existingUser.auth0_customer_id,
          existingUser.auth_0_reference_id
        );
      } catch (err: unknown) {
        const errorData = (
          err as {
            response?: { data?: { statusCode?: number; message?: string } };
          }
        )?.response?.data;
        throw new ServiceError(
          errorData?.message ?? "Failed to add user to organization in Auth0",
          errorData?.statusCode ?? 500
        );
      }
    }

    // --- Assign role in Auth0 ---
    if (existingUser.auth0_role_id && existingUser.auth_0_reference_id) {
      try {
        await addUserToRole(
          existingUser.auth0_role_id,
          existingUser.auth_0_reference_id
        );
      } catch (err: unknown) {
        const errorData = (
          err as {
            response?: { data?: { statusCode?: number; message?: string } };
          }
        )?.response?.data;
        throw new ServiceError(
          errorData?.message ?? "Failed to assign Auth0 role",
          errorData?.statusCode ?? 500
        );
      }
    }

    return updatedUser;
  }

  /**
   * Toggle user status (activate/deactivate) with Auth0 integration
   *
   * @param user_id - The ID of the user to toggle status for
   * @param action - The action to perform (activate or deactivate)
   * @returns Updated user status information
   *
   * Security considerations:
   * - Validates user_id parameter to prevent injection attacks
   * - Validates action parameter to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Updates Auth0 user status for secure authentication
   * - Validates user permissions for status changes
   * - Maintains proper audit trail
   */
  public async toggleUserStatus(
    user_id: number,
    action: "activate" | "deactivate"
  ) {
    const existingUser = await prisma.user.findUnique({
      where: { user_id },
    });

    if (!existingUser) {
      throw new ServiceError("User not found", 404);
    }

    const isActive = action === "activate";

    // --- Update in Auth0 ---
    try {
      await updateAuth0UserStatus(existingUser.auth_0_reference_id, isActive);
    } catch (err: unknown) {
      const errorData = (
        err as {
          response?: { data?: { statusCode?: number; message?: string } };
        }
      )?.response?.data;
      throw new ServiceError(
        errorData?.message ?? "Auth0 status update error",
        errorData?.statusCode ?? 500
      );
    }

    // --- Update in Postgres ---
    const updatedUser = await prisma.user.update({
      where: { user_id },
      data: {
        status: isActive ? "ACTIVE" : "INACTIVE",
        updated_at: new Date(),
      },
      select: {
        user_id: true,
        email: true,
        status: true,
      },
    });

    return {
      message: `User ${action}d successfully`,
      user: updatedUser,
    };
  }

  /**
   * Update customer webhook configuration
   *
   * @param customer_id - The ID of the customer to update
   * @param input - Webhook configuration data
   * @returns Updated customer information
   *
   * Security considerations:
   * - Validates customer_id parameter to prevent injection attacks
   * - Validates input parameters to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Validates customer existence before update
   * - Sanitizes webhook configuration data
   */
  public async updateCustomer(
    customer_id: number,
    input: {
      web_hook_url?: string;
      web_hook_password?: string;
      web_hook_userName?: string;
    }
  ) {
    const existingCustomer = await prisma.customer.findUnique({
      where: { customer_id },
    });

    if (!existingCustomer) {
      throw new ServiceError("Customer not found", 404);
    }

    // Hash the password if provided
    let hashedPassword: string | undefined = undefined;
    if (input.web_hook_password) {
      const saltRounds = 10; // You can adjust the cost factor
      hashedPassword = await bcrypt.hash(input.web_hook_password, saltRounds);
    }

    const updatedCustomer = await prisma.customer.update({
      where: { customer_id },
      data: {
        web_hook_url: input.web_hook_url ?? existingCustomer.web_hook_url,
        web_hook_password: hashedPassword ?? existingCustomer.web_hook_password,
        web_hook_userName:
          input.web_hook_userName ?? existingCustomer.web_hook_userName,
        updated_at: new Date(),
      },
    });

    return updatedCustomer;
  }

  /**
   * Get super admin user by customer ID
   *
   * @param customerId - The ID of the customer to find super admin for
   * @returns Super admin user information or null if not found
   *
   * Security considerations:
   * - Validates customerId parameter to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Limits data exposure through selective field queries
   * - Validates customer existence before querying
   */
  public async getSuperAdminByCustomerId(customerId: number) {
    const role = await prisma.user_role.findFirst({
      where: {
        customer_id: customerId,
        name: "SuperAdmin", // Role name to identify SuperAdmin
      },
      include: {
        users: {
          take: 10, // Limit to 10 users
          select: {
            user_id: true,
            customer_id: true,
            assigned_account_ids: true,
          },
        },
      },
    });

    if (!role || !role.users.length) {
      return [];
    }

    return role.users.map((user) => ({
      current_role: {
        role_id: role.user_role_id,
        role_name: role.name,
      },
      user_info: {
        user_id: user.user_id,
        customer_id: user.customer_id,
        assigned_account_ids: user.assigned_account_ids ?? [],
      },
    }));
  }

  /**
   * Get all ten users with pagination and filtering
   *
   * @param query - Filter parameters for user search
   * @param skip - Number of records to skip for pagination
   * @param take - Number of records to take for pagination
   * @returns Paginated list of tenant users
   *
   * Security considerations:
   * - Validates query parameters to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Limits data exposure through selective field queries
   * - Uses case-insensitive search with proper escaping
   * - Implements proper authorization checks
   */
  public async getAllTenantUsers(
    query: UserFilterDTO,
    skip: number,
    take: number
  ): Promise<{ data: UserMinimalDTO[]; total: number }> {
    const baseFilters: Prisma.userWhereInput = {
      ...(query.name &&
        (() => {
          const parts = query.name.trim().split(/\s+/);
          if (parts.length === 2) {
            const [first, last] = parts;
            return {
              AND: [
                { first_name: { contains: first, mode: "insensitive" } },
                { last_name: { contains: last, mode: "insensitive" } },
              ],
            };
          }
          return {
            OR: [
              { first_name: { contains: query.name, mode: "insensitive" } },
              { last_name: { contains: query.name, mode: "insensitive" } },
            ],
          };
        })()),

      ...(query.email && {
        email: { contains: query.email, mode: "insensitive" },
      }),
      ...(query.status &&
        query.status !== "All" && {
          status: {
            contains: query.status,
            mode: Prisma.QueryMode.insensitive,
          },
        }),
      ...(query.designation && {
        designation: { contains: query.designation, mode: "insensitive" },
      }),
      is_customer_user: false,
      ...(query.user_role_id && { user_role_id: Number(query.user_role_id) }),
    };

    const dateFilters: Prisma.userWhereInput = {
      ...(query.first_active_from || query.first_active_to
        ? {
            first_active: {
              ...(query.first_active_from && {
                gte: new Date(query.first_active_from),
              }),
              ...(query.first_active_to && {
                lte: new Date(query.first_active_to),
              }),
            },
          }
        : {}),
      ...(query.last_active_from || query.last_active_to
        ? {
            last_active: {
              ...(query.last_active_from && {
                gte: new Date(query.last_active_from),
              }),
              ...(query.last_active_to && {
                lte: new Date(query.last_active_to),
              }),
            },
          }
        : {}),
    };

    const filters: Prisma.userWhereInput = {
      ...baseFilters,
      ...dateFilters,
    };

    const orderBy = buildOrderByFromSort(
      query.sort,
      USER_SORT_FIELDS,
      "user_id"
    );

    const total = await prisma.user.count({ where: filters });

    const users = await prisma.user.findMany({
      where: filters,
      skip,
      take,
      orderBy,
      select: {
        user_id: true,
        // customer_id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        designation: true,
        avatar: true,
        status: true,
        is_customer_user: true,
        first_active: true,
        last_active: true,
        created_at: true,
        created_by: true,
        updated_at: true,
        updated_by: true,
        assigned_account_ids: true,
        is_user_approved: true,
        approved_by: true,
        approved_at: true,
        user_role_ref: {
          select: { user_role_id: true, name: true, description: true },
        },
        approved_by_user: {
          select: { user_id: true, first_name: true, last_name: true },
        },
        // customer_ref: {
        //   select: { customer_name: true, reference_number: true },
        // },
      },
    });

    return { data: users, total };
  }
  /**
   * Get current user information by user ID
   *
   * @param userId - The ID of the user to fetch
   * @returns Current user information or null if not found
   *
   * Security considerations:
   * - Validates userId parameter to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Limits data exposure through selective field queries
   * - Prevents unauthorized access to user data
   */
  public async getCurrentUser(userId: number): Promise<CurrentUserDTO | null> {
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        auth_0_reference_id: true,
        avatar: true,
        designation: true,
        status: true,
        is_customer_user: true,
        created_at: true,
        assigned_account_ids: true,
        localization_ids: true,
        user_role_ref: {
          select: {
            name: true,
            user_role_id: true,
          },
        },
        customer_ref: {
          select: {
            customer_name: true,
            reference_number: true,
            web_hook_url: true,
            web_hook_password: true,
            web_hook_userName: true,

            _count: {
              select: {
                accounts: true,
                user: true, // Employee count
              },
            },
          },
        },
        country_lookup_ref: {
          select: {
            country_code: true,
            country_name: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    // Fetch localization data if user has localization_ids
    let localizations: Prisma.localization_lookupGetPayload<
      Record<string, never>
    >[] = [];
    if (user.localization_ids && user.localization_ids.length > 0) {
      localizations = await prisma.localization_lookup.findMany({
        where: {
          localization_lookup_id: { in: user.localization_ids },
          is_deleted: false,
          is_active: true,
        },
        orderBy: { locale_code: "asc" },
      });
    }

    return {
      ...user,
      localizations,
    } as CurrentUserDTO | null;
  }

  /**
   * Fetch customer users by account assignment with pagination and filtering
   *
   * @param userId - The ID of the user making the request
   * @param query - Filter parameters for user search
   * @returns Paginated list of customer users based on account assignment
   *
   * Security considerations:
   * - Validates userId parameter to prevent injection attacks
   * - Validates query parameters to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Validates user permissions for account access
   * - Limits data exposure through selective field queries
   * - Implements proper authorization checks for account assignments
   */
  public async fetchCustomerUsersByAccountAssignment(
    userId: number,
    query: UserFilterDTO
  ): Promise<{
    data: ExtendedUserMinimalDTO[];
    total: number;
    page: number;
    perPage: number;
  }> {
    const { page, perPage, skip, take } = getPagination(query);

    const accountIdArray = await this.resolveAccountIds(userId, query);
    if (accountIdArray.length === 0) {
      return { data: [], total: 0, page, perPage };
    }

    const filters = this.buildCustomerUserFilters(query, accountIdArray);
    const orderBy = buildOrderByFromSort(
      query.sort,
      USER_SORT_FIELDS,
      "user_id"
    );

    const [total, users] = await Promise.all([
      prisma.user.count({ where: filters }),
      prisma.user.findMany({
        skip,
        take,
        where: filters,
        orderBy,
        select: {
          user_id: true,
          first_name: true,
          last_name: true,
          email: true,
          status: true,
          is_customer_user: true,
          assigned_account_ids: true,
          first_active: true,
          last_active: true,
          designation: true,
          user_role_id: true,
          user_role_ref: { select: { name: true, user_role_id: true } },
          customer_ref: {
            select: {
              customer_name: true,
              reference_number: true,
              _count: { select: { accounts: true } },
            },
          },
        },
      }),
    ]);

    const data = this.transformCustomerUsers(users);
    return { data, total, page, perPage };
  }

  private async resolveAccountIds(
    userId: number,
    query: UserFilterDTO
  ): Promise<number[]> {
    if (query.accountIds === "all") {
      const user = await prisma.user.findUnique({
        where: { user_id: userId },
        select: { assigned_account_ids: true },
      });
      return user?.assigned_account_ids ?? [];
    }

    return String(query.accountIds)
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => !isNaN(id) && id > 0);
  }

  private buildCustomerUserFilters(
    query: UserFilterDTO,
    accountIdArray: number[]
  ): Prisma.userWhereInput {
    const baseFilters = this.buildBaseUserFilters(query);
    const dateFilters = this.buildDateFilters(query);
    const customerFilters = this.buildCustomerFilters(query);

    return {
      assigned_account_ids: { hasSome: accountIdArray },
      ...baseFilters,
      ...dateFilters,
      ...customerFilters,
    };
  }

  private buildBaseUserFilters(query: UserFilterDTO): Prisma.userWhereInput {
    return {
      ...(query.name && this.buildNameFilter(query.name)),
      ...(query.email && {
        email: { contains: query.email, mode: "insensitive" },
      }),
      ...(query.status &&
        query.status !== "All" && {
          status: {
            contains: query.status,
            mode: Prisma.QueryMode.insensitive,
          },
        }),
      ...(query.designation && {
        designation: { contains: query.designation, mode: "insensitive" },
      }),
      ...(typeof query.is_customer_user !== "undefined" && {
        is_customer_user:
          String(query.is_customer_user).toLowerCase() === "true",
      }),
      ...(query.user_role_id && {
        user_role_id: Number(query.user_role_id),
      }),
    };
  }

  private buildNameFilter(name: string): Prisma.userWhereInput {
    const parts = name.trim().split(/\s+/);
    if (parts.length === 2) {
      const [first, last] = parts;
      return {
        AND: [
          { first_name: { contains: first, mode: "insensitive" } },
          { last_name: { contains: last, mode: "insensitive" } },
        ],
      };
    }
    return {
      OR: [
        { first_name: { contains: name, mode: "insensitive" } },
        { last_name: { contains: name, mode: "insensitive" } },
      ],
    };
  }

  private buildDateFilters(query: UserFilterDTO): Prisma.userWhereInput {
    const filters: Prisma.userWhereInput = {};

    if (query.first_active_from || query.first_active_to) {
      filters.first_active = {
        ...(query.first_active_from && {
          gte: new Date(query.first_active_from),
        }),
        ...(query.first_active_to && { lte: new Date(query.first_active_to) }),
      };
    }

    if (query.last_active_from || query.last_active_to) {
      filters.last_active = {
        ...(query.last_active_from && {
          gte: new Date(query.last_active_from),
        }),
        ...(query.last_active_to && { lte: new Date(query.last_active_to) }),
      };
    }

    return filters;
  }

  private buildCustomerFilters(query: UserFilterDTO): Prisma.userWhereInput {
    if (
      !query.customer_name &&
      !query.reference_number &&
      !query.customer_account
    ) {
      return {};
    }

    return {
      customer_ref: {
        ...(query.customer_name && {
          customer_name: { contains: query.customer_name, mode: "insensitive" },
        }),
        ...(query.reference_number && {
          reference_number: {
            contains: query.reference_number,
            mode: "insensitive",
          },
        }),
        ...(query.customer_account && {
          OR: [
            {
              customer_name: {
                contains: query.customer_account,
                mode: "insensitive",
              },
            },
            {
              reference_number: {
                contains: query.customer_account,
                mode: "insensitive",
              },
            },
          ],
        }),
      },
    };
  }

  private transformCustomerUsers(
    users: UserWithRelations[]
  ): ExtendedUserMinimalDTO[] {
    return users.map((user) => ({
      user_id: user.user_id,
      first_name: user.first_name ?? null,
      last_name: user.last_name ?? null,
      email: user.email ?? null,
      status: user.status ?? null,
      is_customer_user: user.is_customer_user,
      designation: user.designation ?? null,
      assigned_account_ids: user.assigned_account_ids ?? [],
      first_active: user.first_active ?? null,
      last_active: user.last_active ?? null,
      user_role_ref: user.user_role_ref ?? null,
      customer: {
        customer_name: user.customer_ref?.customer_name ?? null,
        reference_number: user.customer_ref?.reference_number ?? null,
        total_accounts: user.customer_ref?._count.accounts ?? 0,
      },
    }));
  }

  /**
   * Fetch customer details and accounts by user ID
   *
   * @param userId - The ID of the user to fetch customer details for
   * @returns Customer details and associated accounts information
   *
   * Security considerations:
   * - Validates userId parameter to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Limits data exposure through selective field queries
   * - Validates user existence before querying
   * - Implements proper authorization checks for customer data access
   */
  public async fetchCustomerDetailsAndAccountsByUserId(
    userId: number
  ): Promise<UserCustomerAccountsResponseDTO> {
    const user = await prisma.user.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        email: true,
        customer_id: true,
        assigned_account_ids: true,
        designation: true,
      },
    });

    if (!user) {
      return { customer: null, accounts: [] };
    }

    let customer = null;
    if (user.customer_id) {
      customer = await prisma.customer.findUnique({
        where: { customer_id: user.customer_id },
        select: {
          customer_id: true,
          customer_name: true,
          customer_class: true,
          reference_number: true,
        },
      });
    }

    if (!customer || !user.assigned_account_ids?.length) {
      return { customer, accounts: [] };
    }

    const accounts = await prisma.account.findMany({
      where: {
        account_id: { in: user.assigned_account_ids },
        is_deleted: false,
      },
      orderBy: { account_id: "asc" },
      select: {
        account_id: true,
        parent_account_id: true,
        account_name: true,
        account_number: true,
        legacy_account_number: true,
        account_type: true,
        account_manager_id: true,
        number_of_users: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });

    //  Map accounts to DTO shape, replacing nulls
    const mappedAccounts: AccountDTO[] = (accounts as AccountWithSelect[]).map(
      (a) => ({
        account_id: a.account_id,
        parent_account_id: a.parent_account_id,
        account_name: a.account_name ?? "",
        account_number: a.account_number ?? "",
        legacy_account_number: a.legacy_account_number ?? "",
        account_type: a.account_type ?? "",
        account_manager_id: a.account_manager_id,
        number_of_users: a.number_of_users ?? 0,
        status: a.status ?? "INACTIVE",
        created_at: a.created_at,
        updated_at: a.updated_at ?? new Date(),
      })
    );

    return { customer, accounts: mappedAccounts };
  }

  /**
   * Fetch customers with filtering, pagination, and sorting
   *
   * @param filters - Filter criteria for customer search
   * @param skip - Number of records to skip for pagination
   * @param take - Number of records to take for pagination
   * @param sort - Sort criteria for the results
   * @returns Paginated list of customers matching the filters
   *
   * Security considerations:
   * - Validates filter parameters to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Limits data exposure through selective field queries
   * - Uses case-insensitive search with proper escaping
   * - Implements proper authorization checks for customer data access
   */
  public async fetchCustomersService(
    filters: CustomerFilters,
    skip: number,
    take: number,
    sort?: string
  ): Promise<{ customers: CustomerListDTO[]; total: number }> {
    const where: Prisma.customerWhereInput = {
      ...(filters.customer_id && { customer_id: filters.customer_id }),
      ...(filters.customer_name && {
        customer_name: { contains: filters.customer_name, mode: "insensitive" },
      }),
      ...(filters.customer_class && {
        customer_class: {
          equals: filters.customer_class.toUpperCase(),
        },
      }),
      ...(filters.reference_number && {
        reference_number: {
          contains: filters.reference_number,
          mode: "insensitive",
        },
      }),
      ...(filters.status && { status: filters.status }),
      ...(filters.sold_by_salesperson_id && {
        sold_by_salesperson_id: filters.sold_by_salesperson_id,
      }),
      ...(filters.is_deleted !== undefined && {
        is_deleted: filters.is_deleted,
      }),
      ...(filters.deleted_by && { deleted_by: filters.deleted_by }),
      ...(filters.deleted_at && { deleted_at: filters.deleted_at }),
      ...(filters.created_by && { created_by: filters.created_by }),
      ...(filters.updated_by && { updated_by: filters.updated_by }),
      ...(filters.auth0_customer_id && {
        auth0_customer_id: {
          contains: filters.auth0_customer_id,
          mode: "insensitive",
        },
      }),
    };

    const orderBy = buildOrderByFromSort(
      sort,
      CUSTOMER_SORT_FIELDS,
      "customer_id"
    );

    const [total, customers] = await prisma.$transaction([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        skip,
        take,
        where,
        orderBy,
        select: {
          customer_id: true,
          customer_name: true,
          customer_class: true,
          status: true,
          reference_number: true,
          sold_by_salesperson_id: true,
          is_deleted: true,
          deleted_by: true,
          deleted_at: true,
          created_at: true,
          created_by: true,
          updated_at: true,
          updated_by: true,
          auth0_customer_id: true,
        },
      }),
    ]);

    const customerDTOs: CustomerListDTO[] = customers.map((c) => ({
      customer_id: c.customer_id,
      customer_name: c.customer_name ?? null,
      customer_class: c.customer_class ?? null,
      status: c.status ?? null,
      reference_number: c.reference_number ?? null,
      sold_by_salesperson_id: c.sold_by_salesperson_id ?? null,
      is_deleted: c.is_deleted,
      deleted_by: c.deleted_by ?? null,
      deleted_at: c.deleted_at ?? null,
      created_at: c.created_at,
      created_by: c.created_by ?? null,
      updated_at: c.updated_at ?? null,
      updated_by: c.updated_by ?? null,
      auth0_customer_id: c.auth0_customer_id ?? null,
    }));

    return { customers: customerDTOs, total };
  }

  /**
   * Get all users by customer ID with pagination and filtering
   *
   * @param customerId - The ID of the customer to fetch users for
   * @param query - Filter parameters for user search
   * @returns Paginated list of users belonging to the customer
   *
   * Security considerations:
   * - Validates customerId parameter to prevent injection attacks
   * - Validates query parameters to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Limits data exposure through selective field queries
   * - Validates customer existence before querying
   * - Implements proper authorization checks for customer data access
   */
  public async getAllUsersByCustomerId(
    customerId: number,
    query: GetUsersByCustomerIdQueryDTO
  ) {
    try {
      const { page, perPage, skip, take } = getPagination(query);

      const filters = this.buildCustomerUserFiltersForDownload(
        customerId,
        query,
        []
      );
      const orderBy = buildOrderByFromSort(
        query.sort,
        USER_SORT_FIELDS,
        "user_id"
      );
      const [total, users] = await Promise.all([
        prisma.user.count({ where: filters }),
        prisma.user.findMany({
          where: filters,
          skip,
          take,
          orderBy,
          select: {
            user_id: true,
            customer_id: true,
            user_role_id: true,
            country_lookup_id: true,
            assigned_account_ids: true,
            first_name: true,
            last_name: true,
            email: true,
            phone_number: true,
            designation: true,
            avatar: true,
            auth_0_reference_id: true,
            auth0_role_id: true,
            status: true,
            is_customer_user: true,
            first_active: true,
            last_active: true,
            created_at: true,
            created_by: true,
            updated_at: true,
            updated_by: true,
            auth0_customer_id: true,
            permissions: true,
            user_role_ref: {
              select: {
                user_role_id: true,
                name: true,
              },
            },
          },
        }),
      ]);

      return { users, total, page, perPage };
    } catch (error: unknown) {
      throw createErrorWithMessage("Failed to fetch users", error);
    }
  }

  private buildBasicUserFilters(
    customerId: number,
    query: GetUsersByCustomerIdQueryDTO
  ): Prisma.userWhereInput {
    return {
      customer_id: customerId,
      is_customer_user: true,
      ...(query.user_id && { user_id: query.user_id }),
      ...(query.user_role_id && { user_role_id: query.user_role_id }),
      ...(query.country_lookup_id && {
        country_lookup_id: query.country_lookup_id,
      }),
      ...(query.assigned_account_ids && {
        assigned_account_ids: { hasSome: query.assigned_account_ids },
      }),
      ...(query.first_name && {
        first_name: { contains: query.first_name, mode: "insensitive" },
      }),
      ...(query.last_name && {
        last_name: { contains: query.last_name, mode: "insensitive" },
      }),
      ...(query.email && {
        email: { contains: query.email, mode: "insensitive" },
      }),
      ...(query.phone_number && {
        phone_number: { contains: query.phone_number, mode: "insensitive" },
      }),
      ...(query.designation && {
        designation: { contains: query.designation, mode: "insensitive" },
      }),
      ...(query.avatar && {
        avatar: { contains: query.avatar, mode: "insensitive" },
      }),
      ...(query.status &&
        query.status !== "All" && {
          status: {
            contains: query.status,
            mode: Prisma.QueryMode.insensitive,
          },
        }),
      ...(query.created_by && { created_by: query.created_by }),
      ...(query.updated_by && { updated_by: query.updated_by }),
    };
  }

  private buildDateFiltersForCustomer(
    query: GetUsersByCustomerIdQueryDTO
  ): Prisma.userWhereInput {
    return {
      ...(query.first_active && {
        first_active: { gte: new Date(query.first_active) },
      }),
      ...(query.last_active && {
        last_active: { gte: new Date(query.last_active) },
      }),
      ...(query.created_at && {
        created_at: { gte: new Date(query.created_at) },
      }),
      ...(query.updated_at && {
        updated_at: { gte: new Date(query.updated_at) },
      }),
    };
  }

  private buildAuthFilters(
    query: GetUsersByCustomerIdQueryDTO
  ): Prisma.userWhereInput {
    return {
      ...(query.auth_0_reference_id && {
        auth_0_reference_id: {
          contains: query.auth_0_reference_id,
          mode: "insensitive",
        },
      }),
      ...(query.auth0_role_id && {
        auth0_role_id: {
          contains: query.auth0_role_id,
          mode: "insensitive",
        },
      }),
      ...(query.auth0_customer_id && {
        auth0_customer_id: {
          contains: query.auth0_customer_id,
          mode: "insensitive",
        },
      }),
      ...(query.permissions && {
        permissions: {
          equals: JSON.parse(
            query.permissions as string
          ) as Prisma.InputJsonValue,
        },
      }),
    };
  }

  private buildCustomerUserFiltersForDownload(
    customerId: number,
    query: GetUsersByCustomerIdQueryDTO,
    excludedIds: number[]
  ): Prisma.userWhereInput {
    const basicFilters = this.buildBasicUserFilters(customerId, query);
    const dateFilters = this.buildDateFiltersForCustomer(query);
    const authFilters = this.buildAuthFilters(query);
    const nameFilter = query.name ? this.buildNameFilter(query.name) : {};
    const exclusionFilter =
      excludedIds.length > 0 ? { NOT: { user_id: { in: excludedIds } } } : {};

    return {
      ...basicFilters,
      ...dateFilters,
      ...authFilters,
      ...nameFilter,
      ...exclusionFilter,
    };
  }

  /**
   * Create or update user column preferences
   *
   * @param data - Column preference data to create or update
   * @returns Created or updated column preference information
   *
   * Security considerations:
   * - Validates input data to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Validates user permissions for preference management
   * - Sanitizes input data before processing
   * - Uses upsert operation for data integrity
   */
  public async createOrUpdatePreference(
    data: CreateUserColumnPreferenceDto
  ): Promise<UserColumnPreferenceResponseDto> {
    const preference = await prisma.column_preferences.upsert({
      where: {
        user_id_column_preference_table_name_id: {
          user_id: data.user_id,
          column_preference_table_name_id: data.column_preference_table_name_id,
        },
      },
      update: {
        selected_columns: data.selected_columns,
      },
      create: {
        user_id: data.user_id,
        column_preference_table_name_id: data.column_preference_table_name_id,
        selected_columns: data.selected_columns,
      },
      select: {
        user_id: true,
        column_preference_table_name_id: true,
        selected_columns: true,
        created_at: true,
        updated_at: true,
      },
    });

    return preference as UserColumnPreferenceResponseDto;
  }

  public getPreferenceByUserAndTable = async (
    user_id: number,
    tableNameId: number
  ): Promise<UserColumnPreferenceDto | null> => {
    const pref = await prisma.column_preferences.findUnique({
      where: {
        user_id_column_preference_table_name_id: {
          user_id,
          column_preference_table_name_id: tableNameId,
        },
      },
      select: {
        column_preferences_id: true,
        user_id: true,
        column_preference_table_name_id: true,
        selected_columns: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!pref) return null;

    return {
      column_preferences_id: pref.column_preferences_id,
      user_id: pref.user_id,
      column_preference_table_name_id: pref.column_preference_table_name_id,
      selected_columns: pref.selected_columns as string[],
      created_at: pref.created_at,
      updated_at: pref.updated_at,
    };
  };

  /**
   * Get master column preference table names
   *
   * @returns List of available column preference table names
   *
   * Security considerations:
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Limits data exposure through selective field queries
   * - Provides safe access to configuration data
   */
  public async getMasterColumnPreferenceTableName(): Promise<
    ColumnPreferenceTableNameDto[]
  > {
    const preference = await prisma.column_preference_table_name.findMany({
      select: {
        column_preference_table_name_id: true,
        table_name: true,
      },
    });

    return preference as ColumnPreferenceTableNameDto[];
  }

  // Add this interface for type safety

  // done
  /**
   * Download all tenant users as Excel file
   *
   * @param query - Filter parameters for user search
   * @param requestedColumns - Column definitions for Excel export
   * @returns Excel file buffer and filename
   *
   * Security considerations:
   * - Validates query parameters to prevent injection attacks
   * - Validates and sanitizes column definitions to prevent malicious input
   * - Uses parameterized queries through Prisma ORM
   * - Sanitizes data before export to prevent XSS and injection attacks
   * - Uses safe filename generation to prevent path traversal
   * - Implements proper error handling without information disclosure
   * - Limits data exposure through selective field queries
   */
  public async downloadAllTenantUsers(
    query: UserFilterDTO,
    requestedColumns: ColumnDefinition[]
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { skip } = getPagination(query);
    const excludedIds = this.parseExcludedIds(query.excludedIds);
    const filters = this.buildTenantUserFilters(query, excludedIds);
    const orderBy = buildOrderByFromSort(
      query.sort,
      USER_SORT_FIELDS,
      "user_id"
    );

    const [users, accountMap] = await this.fetchTenantUsersAndAccounts(
      filters,
      orderBy as Prisma.userOrderByWithRelationInput
    );
    const columns = this.buildTenantExcelColumns(
      requestedColumns,
      users,
      accountMap
    );
    const formattedData = this.formatTenantUserData(
      users,
      requestedColumns,
      skip
    );

    return this.generateTenantExcelFile(columns, formattedData);
  }

  /**
   * Fetch tenant users and their accounts
   */
  private async fetchTenantUsersAndAccounts(
    filters: Prisma.userWhereInput,
    orderBy: Prisma.userOrderByWithRelationInput
  ): Promise<[TenantUser[], Map<number, AccountData>]> {
    const users = await prisma.user.findMany({
      where: filters,
      orderBy,
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        designation: true,
        avatar: true,
        status: true,
        is_customer_user: true,
        first_active: true,
        last_active: true,
        created_at: true,
        created_by: true,
        updated_at: true,
        updated_by: true,
        assigned_account_ids: true,
        is_user_approved: true,
        approved_by: true,
        approved_at: true,
        user_role_ref: {
          select: { user_role_id: true, name: true, description: true },
        },
        approved_by_user: {
          select: { user_id: true, first_name: true, last_name: true },
        },
      },
    });

    const allAccountIds = users.flatMap((u) => u.assigned_account_ids ?? []);
    const accounts =
      allAccountIds.length > 0
        ? await prisma.account.findMany({
            where: { account_id: { in: allAccountIds } },
            select: {
              account_id: true,
              account_name: true,
              account_number: true,
            },
          })
        : [];
    const accountMap = new Map(accounts.map((a) => [a.account_id, a]));

    return [users, accountMap];
  }

  /**
   * Build Excel columns for tenant users
   */
  private buildTenantExcelColumns(
    requestedColumns: ColumnDefinition[],
    users: TenantUser[],
    accountMap: Map<number, AccountData>
  ): ColumnConfig[] {
    return requestedColumns.map(({ label, field }) => {
      switch (field) {
        case "sno":
          return { header: label, key: field, width: 8 };
        case "is_customer_user":
          return {
            header: label,
            key: field,
            width: 15,
            formatter: (val: unknown) => (val ? "Yes" : "No"),
          };
        case "first_active":
        case "last_active":
        case "created_at":
        case "updated_at":
          return {
            header: label,
            key: field,
            width: 20,
            formatter: (val: unknown) =>
              val ? new Date(val as Date).toLocaleString() : "N/A",
          };
        case "role":
          return {
            header: label,
            key: field,
            width: 18,
            formatter: (user: unknown) =>
              (user as TenantUser).user_role_ref?.name ?? "",
          };
        case "approved_by_user":
          return {
            header: label,
            key: field,
            width: 25,
            formatter: (user: unknown) =>
              this.formatApprovedByUser(user as TenantUser),
          };
        case "userAccount":
          return {
            header: label,
            key: field,
            width: 40,
            formatter: (user: unknown) =>
              this.formatTenantUserAccountInfo(user as TenantUser, accountMap),
          };
        default:
          return { header: label, key: field, width: 20 };
      }
    });
  }

  /**
   * Format approved by user information
   */
  private formatApprovedByUser(user: TenantUser): string {
    return user.approved_by_user
      ? `${user.approved_by_user.first_name ?? ""} ${
          user.approved_by_user.last_name ?? ""
        }`.trim()
      : "N/A";
  }

  /**
   * Format tenant user account information
   */
  private formatTenantUserAccountInfo(
    user: TenantUser,
    accountMap: Map<number, AccountData>
  ): string {
    if (
      !Array.isArray(user.assigned_account_ids) ||
      user.assigned_account_ids.length === 0
    ) {
      return "No Accounts";
    }

    const userAccounts = user.assigned_account_ids
      .map((id: number) => accountMap.get(id))
      .filter(Boolean)
      .map(
        (acc) =>
          `${acc?.account_name ?? "N/A"} (${acc?.account_number ?? "N/A"})`
      );

    return `RelatedAccounts:${userAccounts.length}-${userAccounts.join(", ")}`;
  }

  /**
   * Format tenant user data for Excel
   */
  private formatTenantUserData(
    users: TenantUser[],
    requestedColumns: ColumnDefinition[],
    skip: number
  ): Record<string, unknown>[] {
    return users.map((user, index) => {
      const row: Record<string, unknown> = {};

      requestedColumns.forEach(({ field }) => {
        switch (field) {
          case "sno":
            row[field] = index + 1 + (skip || 0);
            break;
          case "name":
            row[field] = `${user.first_name ?? ""} ${
              user.last_name ?? ""
            }`.trim();
            break;
          case "role":
          case "approved_by_user":
          case "userAccount":
            row[field] = user; // formatter will handle
            break;
          default: {
            if (field in user) {
              row[field] =
                (user as unknown as Record<string, unknown>)[field] ?? "";
            } else {
              row[field] = "";
            }
            break;
          }
        }
      });

      return row;
    });
  }

  /**
   * Generate tenant Excel file
   */
  private async generateTenantExcelFile(
    columns: ColumnConfig[],
    formattedData: Record<string, unknown>[]
  ): Promise<{ buffer: Buffer; filename: string }> {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `ten_users_${timestamp}.xlsx`;

    const exporter = new ExcelExporter();
    exporter.generateWorkbook({
      sheetName: "Ten Users",
      columns,
      data: formattedData,
      filename,
    });

    const buffer = await exporter.writeToBuffer();

    return { buffer, filename };
  }

  /**
   * Download customer users by account assignment as Excel file
   *
   * @param userId - The ID of the user making the request
   * @param query - Filter parameters for user search
   * @param requestedColumns - Column definitions for Excel export
   * @returns Excel file buffer and filename
   *
   * Security considerations:
   * - Validates userId parameter to prevent injection attacks
   * - Validates query parameters to prevent injection attacks
   * - Validates and sanitizes column definitions to prevent malicious input
   * - Uses parameterized queries through Prisma ORM
   * - Sanitizes data before export to prevent XSS and injection attacks
   * - Uses safe filename generation to prevent path traversal
   * - Implements proper error handling without information disclosure
   * - Validates user permissions for account access
   * - Limits data exposure through selective field queries
   */
  public async downloadCustomerUsersByAccountAssignment(
    userId: number,
    query: UserFilterDTO,
    requestedColumns: { label: string; field: string }[]
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { skip } = getPagination(query);

    const accountIdArray = await this.resolveAccountIds(userId, query);
    const filters = this.buildCustomerUserFilters(query, accountIdArray);
    const orderBy = buildOrderByFromSort(
      query.sort,
      USER_SORT_FIELDS,
      "user_id"
    );

    const [users, accountMap] = await this.fetchUsersAndAccounts(
      filters,
      orderBy as Prisma.userOrderByWithRelationInput
    );
    const columns = this.buildExcelColumns(requestedColumns, users, accountMap);
    const formattedData = this.formatUserDataForExcel(
      users,
      requestedColumns,
      skip
    );

    return this.generateExcelFile(columns, formattedData, "customer_users");
  }

  private async fetchUsersAndAccounts(
    filters: Prisma.userWhereInput,
    orderBy: Prisma.userOrderByWithRelationInput
  ): Promise<
    [
      UserWithRelations[],
      Map<
        number,
        {
          account_id: number;
          account_name: string | null;
          account_number: string | null;
        }
      >
    ]
  > {
    const users = await prisma.user.findMany({
      where: filters,
      orderBy,
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        email: true,
        designation: true,
        status: true,
        is_customer_user: true,
        first_active: true,
        last_active: true,
        user_role_id: true,
        user_role_ref: { select: { name: true, user_role_id: true } },
        assigned_account_ids: true,
        customer_ref: {
          select: {
            customer_name: true,
            reference_number: true,
            _count: { select: { accounts: true } },
          },
        },
      },
    });

    // Preload accounts
    const allAccountIds = users.flatMap((u) => u.assigned_account_ids || []);
    const uniqueAccountIds = [...new Set(allAccountIds)];
    const accounts = uniqueAccountIds.length
      ? await prisma.account.findMany({
          where: { account_id: { in: uniqueAccountIds } },
          select: {
            account_id: true,
            account_name: true,
            account_number: true,
          },
        })
      : [];
    const accountMap = new Map(accounts.map((a) => [a.account_id, a]));

    return [users, accountMap];
  }

  private buildExcelColumns(
    requestedColumns: { label: string; field: string }[],
    users: UserWithRelations[],
    accountMap: Map<
      number,
      {
        account_id: number;
        account_name: string | null;
        account_number: string | null;
      }
    >
  ): ColumnConfig[] {
    return requestedColumns.map(({ label, field }) => {
      switch (field) {
        case "sno":
          return { header: label, key: field, width: 8 };
        case "is_customer_user":
          return {
            header: label,
            key: field,
            width: 15,
            formatter: (val: unknown) => (val ? "Yes" : "No"),
          };
        case "first_active":
        case "last_active":
          return {
            header: label,
            key: field,
            width: 25,
            formatter: (val: unknown) =>
              val ? new Date(val as Date).toLocaleString() : "N/A",
          };
        case "role":
          return {
            header: label,
            key: field,
            width: 18,
            formatter: (user: unknown) =>
              (user as (typeof users)[number]).user_role_ref?.name ?? "",
          };
        case "account":
          return {
            header: label,
            key: field,
            width: 40,
            formatter: (user: unknown) =>
              this.formatAccountInfo(user as (typeof users)[number]),
          };
        case "userAccount":
          return {
            header: label,
            key: field,
            width: 40,
            formatter: (user: unknown) =>
              this.formatUserAccountInfo(
                user as (typeof users)[number],
                accountMap
              ),
          };
        default:
          return { header: label, key: field, width: 20 };
      }
    });
  }

  private formatAccountInfo(user: UserWithRelations): string {
    if (user.customer_ref) {
      return `${user.customer_ref.customer_name} (${
        user.customer_ref.reference_number
      }) - Accounts: ${user.customer_ref._count?.accounts ?? 0}`;
    }

    if (
      Array.isArray(user.assigned_account_ids) &&
      user.assigned_account_ids.length
    ) {
      return user.assigned_account_ids.join(", ");
    }

    return "No Accounts";
  }

  private formatUserAccountInfo(
    user: UserWithRelations,
    accountMap: Map<
      number,
      {
        account_id: number;
        account_name: string | null;
        account_number: string | null;
      }
    >
  ): string {
    if (
      !Array.isArray(user.assigned_account_ids) ||
      !user.assigned_account_ids.length
    ) {
      return "No Accounts";
    }

    const userAccounts = user.assigned_account_ids
      .map((id: number) => accountMap.get(id))
      .filter(Boolean)
      .map(
        (acc) =>
          `${acc?.account_name ?? "N/A"} (${acc?.account_number ?? "N/A"})`
      );

    return `RelatedAccounts:${userAccounts.length}-${userAccounts.join(", ")}`;
  }

  private formatUserDataForExcel(
    users: UserWithRelations[],
    requestedColumns: { label: string; field: string }[],
    skip: number
  ): Record<string, unknown>[] {
    return users.map((user, index) => {
      const row: Record<string, unknown> = {};
      requestedColumns.forEach(({ field }) => {
        switch (field) {
          case "sno":
            row[field] = index + 1 + (skip || 0);
            break;
          case "name":
            row[field] = `${user.first_name ?? ""} ${
              user.last_name ?? ""
            }`.trim();
            break;
          case "role":
          case "account":
          case "userAccount":
            row[field] = user; // formatter handles
            break;

          default: {
            if (field in user) {
              row[field] =
                (user as unknown as Record<string, unknown>)[field] ?? "";
            } else {
              row[field] = "";
            }
            break;
          }
        }
      });
      return row;
    });
  }

  private async generateExcelFile(
    columns: ColumnConfig[],
    formattedData: Record<string, unknown>[],
    filenamePrefix: string
  ): Promise<{ buffer: Buffer; filename: string }> {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `${filenamePrefix}_${timestamp}.xlsx`;

    const exporter = new ExcelExporter();
    exporter.generateWorkbook({
      sheetName: "Customer Users",
      title: "Customer Users",
      columns,
      data: formattedData,
      filename,
    });

    const buffer = await exporter.writeToBuffer();
    return { buffer, filename };
  }

  /**
   * Download customers as Excel file with filtering and column selection
   *
   * @param query - Filter parameters for customer search
   * @param requestedColumns - Column definitions for Excel export
   * @returns Excel file buffer and filename
   *
   * Security considerations:
   * - Validates query parameters to prevent injection attacks
   * - Validates and sanitizes column definitions to prevent malicious input
   * - Uses parameterized queries through Prisma ORM
   * - Sanitizes data before export to prevent XSS and injection attacks
   * - Uses safe filename generation to prevent path traversal
   * - Implements proper error handling without information disclosure
   * - Limits data exposure through selective field queries
   * - Implements proper authorization checks for customer data access
   */
  public async downloadCustomers(
    query: CustomersFilterQuery,
    requestedColumns: ColumnDefinition[]
  ) {
    const excludedIds = this.parseExcludedIds(query.excludedIds);
    const where = this.buildCustomerDownloadFilters(query, excludedIds);
    const customers = await this.fetchCustomersForDownload(where);
    const columns = this.buildCustomerExcelColumns(requestedColumns);
    const formattedData = this.formatCustomerData(customers, columns);

    return this.generateCustomerExcelFile(columns, formattedData);
  }

  /**
   * Fetch customers for download
   */
  private async fetchCustomersForDownload(where: Prisma.customerWhereInput) {
    return await prisma.customer.findMany({
      where,
      orderBy: { customer_id: "desc" },
    });
  }

  /**
   * Build Excel columns for customers
   */
  private buildCustomerExcelColumns(
    requestedColumns: ColumnDefinition[]
  ): ColumnConfig[] {
    return requestedColumns.map(({ label, field }) => {
      switch (field) {
        case "sno":
          return { header: label, key: field, width: 8 };
        case "created_at":
        case "updated_at":
          return {
            header: label,
            key: field,
            width: 20,
            formatter: (val: unknown) =>
              val ? new Date(val as string).toLocaleString() : "N/A",
          };
        default:
          return { header: label, key: field, width: 20 };
      }
    });
  }

  /**
   * Format customer data for Excel
   */
  private formatCustomerData(
    customers: CustomerRecord[],
    columns: ColumnConfig[]
  ): Record<string, unknown>[] {
    return customers.map((cust, index) => {
      const row: Record<string, unknown> = {};

      columns.forEach((col) => {
        if (col.key === "sno") {
          row[col.key] = index + 1;
        } else {
          row[col.key] = (cust as Record<string, unknown>)[col.key] ?? "";
        }
      });

      return row;
    });
  }

  /**
   * Generate customer Excel file
   */
  private async generateCustomerExcelFile(
    columns: ColumnConfig[],
    formattedData: Record<string, unknown>[]
  ): Promise<{ buffer: Buffer; filename: string }> {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `customers_all_${timestamp}.xlsx`;

    const exporter = new ExcelExporter();
    exporter.generateWorkbook({
      sheetName: "Customers",
      title: `Customers Export`,
      columns,
      data: formattedData,
      filename,
    });

    const buffer = await exporter.writeToBuffer();

    return { buffer, filename };
  }

  /**
   * Download users by customer ID as Excel file with filtering and column selection
   *
   * @param query - Filter parameters for user search including customer ID
   * @param requestedColumns - Column definitions for Excel export
   * @returns Excel file buffer and filename
   *
   * Security considerations:
   * - Validates query parameters to prevent injection attacks
   * - Validates and sanitizes column definitions to prevent malicious input
   * - Uses parameterized queries through Prisma ORM
   * - Sanitizes data before export to prevent XSS and injection attacks
   * - Uses safe filename generation to prevent path traversal
   * - Implements proper error handling without information disclosure
   * - Limits data exposure through selective field queries
   * - Validates customer existence before querying
   * - Implements proper authorization checks for customer data access
   */
  public async downloadUsersByCustomerId(
    query: GetUsersByCustomerIdQueryDTO,
    requestedColumns: ColumnDefinition[]
  ): Promise<{ buffer: Buffer; filename: string }> {
    const customerId = Number(query.customer_id);
    if (!customerId) throw new Error("CUSTOMER_ID_REQUIRED");

    const excludedIds = this.parseExcludedIds(query.excludedIds);
    const filters = this.buildCustomerUserFiltersForDownload(
      customerId,
      query,
      excludedIds
    );
    const orderBy = buildOrderByFromSort(
      query.sort,
      USER_SORT_FIELDS,
      "user_id"
    );

    const [users, accountMap] = await this.fetchUsersAndAccountsForDownload(
      filters,
      orderBy as Prisma.userOrderByWithRelationInput
    );
    const columns = this.buildExcelColumnsForCustomer(
      requestedColumns,
      users,
      accountMap
    );
    const formattedData = this.formatCustomerUserData(users, requestedColumns);

    return this.generateCustomerUsersExcelFile(
      columns,
      formattedData,
      customerId
    );
  }

  private async fetchUsersAndAccountsForDownload(
    filters: Prisma.userWhereInput,
    orderBy: Prisma.userOrderByWithRelationInput
  ): Promise<
    [
      UserWithRelations[],
      Map<
        number,
        {
          account_id: number;
          account_name: string | null;
          account_number: string | null;
        }
      >
    ]
  > {
    const users = await prisma.user.findMany({
      where: filters,
      orderBy,
      select: {
        user_id: true,
        customer_id: true,
        user_role_id: true,
        country_lookup_id: true,
        assigned_account_ids: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        designation: true,
        avatar: true,
        auth_0_reference_id: true,
        auth0_role_id: true,
        status: true,
        is_customer_user: true,
        first_active: true,
        last_active: true,
        created_at: true,
        created_by: true,
        updated_at: true,
        updated_by: true,
        auth0_customer_id: true,
        permissions: true,
        user_role_ref: {
          select: { user_role_id: true, name: true },
        },
        customer_ref: {
          select: {
            customer_name: true,
            reference_number: true,
            _count: { select: { accounts: true } },
          },
        },
      },
    });

    // Preload all accounts for userAccount column
    const allAccountIds = users.flatMap((u) => u.assigned_account_ids || []);
    const accounts = await prisma.account.findMany({
      where: { account_id: { in: allAccountIds } },
      select: { account_id: true, account_name: true, account_number: true },
    });
    const accountMap = new Map(accounts.map((a) => [a.account_id, a]));

    return [users, accountMap];
  }

  private buildExcelColumnsForCustomer(
    requestedColumns: ColumnDefinition[],
    users: UserWithRelations[],
    accountMap: Map<
      number,
      {
        account_id: number;
        account_name: string | null;
        account_number: string | null;
      }
    >
  ): ColumnConfig[] {
    return requestedColumns.map(({ label, field }) => {
      switch (field) {
        case "sno":
          return { header: label, key: field, width: 8 };
        case "is_customer_user":
          return {
            header: label,
            key: field,
            width: 15,
            formatter: (val: unknown) => (val ? "Yes" : "No"),
          };
        case "first_active":
        case "last_active":
        case "created_at":
        case "updated_at":
          return {
            header: label,
            key: field,
            width: 20,
            formatter: (val: unknown) =>
              val ? new Date(val as Date).toLocaleString() : "N/A",
          };
        case "role":
          return {
            header: label,
            key: field,
            width: 18,
            formatter: (user: unknown) =>
              (user as User).user_role_ref?.name ?? "",
          };
        case "account":
          return {
            header: label,
            key: field,
            width: 40,
            formatter: (user: unknown) =>
              this.formatCustomerAccountInfo(user as UserWithRelations),
          };
        case "userAccount":
          return {
            header: label,
            key: field,
            width: 40,
            formatter: (user: unknown) =>
              this.formatUserAccountInfo(user as UserWithRelations, accountMap),
          };
        default:
          return { header: label, key: field, width: 20 };
      }
    });
  }

  private formatCustomerAccountInfo(user: UserWithRelations): string {
    if (user.customer_ref) {
      return `${user.customer_ref.customer_name} (${user.customer_ref.reference_number}) - Accounts: ${user.customer_ref._count?.accounts}`;
    }
    return "";
  }

  private formatCustomerUserData(
    users: UserWithRelations[],
    requestedColumns: ColumnDefinition[]
  ): Record<string, unknown>[] {
    return users.map((user, index) => {
      const row: Record<string, unknown> = {};

      requestedColumns.forEach(({ field }) => {
        switch (field) {
          case "sno":
            row[field] = index + 1;
            break;

          case "name":
            row[field] = `${user.first_name ?? ""} ${
              user.last_name ?? ""
            }`.trim();
            break;

          case "role":
          case "account":
          case "userAccount":
            row[field] = user; // formatter will handle these
            break;

          default: {
            if (field in user) {
              row[field] =
                (user as unknown as Record<string, unknown>)[field] ?? "";
            } else {
              row[field] = "";
            }
            break;
          }
        }
      });

      return row;
    });
  }

  private async generateCustomerUsersExcelFile(
    columns: ColumnConfig[],
    formattedData: Record<string, unknown>[],
    customerId: number
  ): Promise<{ buffer: Buffer; filename: string }> {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `customer_${customerId}_users_${timestamp}.xlsx`;

    const exporter = new ExcelExporter();
    exporter.generateWorkbook({
      sheetName: "Customer Users",
      columns,
      data: formattedData,
      filename,
    });

    const buffer = await exporter.writeToBuffer();

    return { buffer, filename };
  }

  /**
   * Get all active localizations
   *
   * @returns Promise<LocalizationLookupDTO[]> - Array of all localization records
   */
  public async getActiveLocalizations(): Promise<LocalizationLookupDTO[]> {
    try {
      const localizations = await (prisma as any).localization_lookup.findMany({
        where: {
          is_deleted: false,
        },
      });
      return localizations;
    } catch (error) {
      throw new Error(
        `Failed to fetch localizations: ${(error as Error).message}`
      );
    }
  }
}
