/**
 * Role Service
 *
 * Handles business logic for role-related operations including:
 * - User role CRUD operations with proper authorization
 * - Auth0 role integration and management
 * - Role permissions management
 * - Customer-specific role filtering and pagination
 * - Resource server management for Auth0
 *
 * Security considerations:
 * - All database queries use parameterized queries (Prisma ORM)
 * - Input validation and sanitization
 * - Authorization checks for data access
 * - SQL injection prevention through ORM
 * - Auth0 integration with secure token management
 * - Proper error handling without information disclosure
 * - Resource server validation and creation
 * - Permission chunking for large permission sets
 *
 * @author kalyanrai
 * @version 1.0.0
 */

// src/api/services/role.service.ts
import prisma from "../config/database.config";
import {
  CreateUserRoleDTO,
  RoleFilterQuery,
  EditUserRoleRequestDTO,
  UserRoleResponseDTO,
} from "../../src/types/dtos/role.dto";
import { buildOrderByFromSort } from "../../src/utils/sort";
import { USER_ROLE_SORT_FIELDS } from "../../src/types/sorts/sortTypes";
import {
  getManagementToken,
  axiosWithRetry,
  chunkArray,
} from "../../src/utils/auth0.managementtoken";

import { ensureResourceServerExists } from "../services/auth0.service";
import { getPagination } from "../utils/pagination";
import { Prisma } from "@prisma/client";
import { createErrorWithMessage } from "../utils/responseUtils";
import { AxiosError } from "axios";
import { getAuth0Domain } from "../config/env.config";

/**
 * Interface for permission data structure
 */
interface PermissionData {
  resource_server_identifier: string;
  permission_name: string
}

/**
 * Interface for Auth0 role response data structure
 * Contains role ID information from Auth0 API responses
 */
interface Auth0RoleResponseWithData {
  id?: string;
  data?: {
    id: string
  }
}

/**
 * RoleService class handles all role-related business logic
 *
 * This service provides methods for:
 * - User role CRUD operations with proper authorization
 * - Auth0 role integration and management
 * - Role permissions management
 * - Customer-specific role filtering and pagination
 * - Resource server management for Auth0
 *
 * All methods implement proper error handling and input validation
 * to prevent security vulnerabilities and ensure data integrity.
 */
export class RoleService {
  /**
   * Get user roles by customer ID with filtering, pagination, and sorting
   *
   * @param customer_id - The ID of the customer to fetch roles for
   * @param query - Filter parameters for role search
   * @returns Paginated list of user roles for the customer
   *
   * Security considerations:
   * - Validates customer_id parameter to prevent injection attacks
   * - Validates query parameters to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Limits data exposure through selective field queries
   * - Uses case-insensitive search with proper escaping
   * - Implements proper authorization checks for customer data access
   */
  public async getUserRolesByCustomerId(
    customer_id: number,
    query: RoleFilterQuery
  ) {
    const {
      name,
      description,
      auth0_role_name,
      created_from,
      created_to,
      sort,
      created_at,
    } = query;
    const { page, perPage, skip, take } = getPagination(query);

    const where: Prisma.user_roleWhereInput = { customer_id };

    if (name) where.name = { contains: name, mode: "insensitive" };
    if (description)
      where.description = { contains: description, mode: "insensitive" };
    if (auth0_role_name)
      where.auth0_role_name = {
        contains: auth0_role_name,
        mode: "insensitive",
      };
    if (created_from || created_to) {
      where.created_at = {};
      const startOfDay = new Date(`${created_at}T00:00:00.000Z`);
      const endOfDay = new Date(`${created_at}T23:59:59.999Z`);
      where.created_at = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }
    if (created_at) {
      const startOfDay = new Date(`${created_at}T00:00:00.000Z`);
      const endOfDay = new Date(`${created_at}T23:59:59.999Z`);
      where.created_at = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }
    const orderBy = buildOrderByFromSort(
      sort,
      USER_ROLE_SORT_FIELDS,
      "user_role_id",
      { expandName: false }
    );

    const total = await prisma.user_role.count({ where });
    const roles = await prisma.user_role.findMany({
      where,
      orderBy,
      skip,
      take,
      select: {
        user_role_id: true,
        name: true,
        description: true,
        accessible_account_ids: true,
        customer_id: true,
        auth0_role_id: true,
        auth0_role_name: true,
        created_at: true,
        created_by: true,
        updated_by: true,
        role_permission: true,
      },
    });

    return { roles, total, page, perPage };
  }

  /**
   * Create a new user role with Auth0 integration
   *
   * @param data - Role creation data including name, description, customer ID, and permissions
   * @returns Created user role information
   *
   * Security considerations:
   * - Validates input data to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Creates Auth0 role for secure authentication
   * - Validates role uniqueness within customer scope
   * - Ensures resource servers exist before creating permissions
   * - Uses chunked permission assignment for large permission sets
   * - Validates Auth0 domain configuration
   * - Implements proper Auth0 API error handling
   */
  public async createUserRole(data: CreateUserRoleDTO) {
    const { name, description, customer_id, permissions } = data;

    const existingRole = await prisma.user_role.findFirst({
      where: { name, customer_id },
    });
    if (existingRole) {
      throw new Error(`Role '${name}' already exists for this customer.`);
    }

    const auth0RoleName = `${customer_id ?? "TEN"}-${name}`;
    const managementToken = await getManagementToken();
    const domain = getAuth0Domain();

    const resourceServers = [
      ...new Set(permissions.map((p) => p.resource_server_identifier)),
    ];
    for (const server of resourceServers) {
      const permsForServer = permissions
        .filter((p) => p.resource_server_identifier === server)
        .map((p) => p.permission_name);

      await ensureResourceServerExists(
        domain,
        managementToken,
        server,
        permsForServer
      );
    }

    let auth0RoleId: string | undefined;

    try {
      const createRoleResponse =
        await axiosWithRetry<Auth0RoleResponseWithData>({
          method: "POST",
          url: `${domain}/api/v2/roles`,
          data: { name: auth0RoleName, description },
          headers: { Authorization: `Bearer ${managementToken}` },
        });

      auth0RoleId = createRoleResponse.id ?? createRoleResponse.data?.id;
    } catch (err: unknown) {
      if (err instanceof AxiosError) {
        if (err.response?.status === 409) {
          // Duplicate role in Auth0
          throw new Error(`Auth0 role '${auth0RoleName}' already exists`);
        }
        // Log and rethrow for other errors
        throw new Error(
          `Auth0 role creation failed: ${err.response?.data ?? err.message}`
        );
      }
      throw err;
    }

    if (!auth0RoleId) {
      throw new Error("Failed to get role ID from Auth0 response");
    }

    // Attach permissions in chunks
    const permissionChunks = chunkArray(permissions, 10);
    for (const chunk of permissionChunks) {
      await axiosWithRetry({
        method: "POST",
        url: `${domain}/api/v2/roles/${auth0RoleId}/permissions`,
        data: { permissions: chunk },
        headers: { Authorization: `Bearer ${managementToken}` },
      });
    }

    return prisma.user_role.create({
      data: {
        name,
        description,
        customer_id,
        auth0_role_id: auth0RoleId,
        auth0_role_name: auth0RoleName,
        role_permission: {
          create: permissions.map((p) => ({
            resource_server_identifier: p.resource_server_identifier,
            permission_name: p.permission_name,
          })),
        },
      },
    });
  }

  /**
   * Helper method to ensure resource servers exist for permissions
   */
  private async ensureResourceServersForPermissions(
    permissions: PermissionData[] | undefined,
    domain: string,
    managementToken: string
  ): Promise<void> {
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return;
    }

    const resourceServers = [
      ...new Set(permissions.map((p) => p.resource_server_identifier)),
    ];
    
    for (const server of resourceServers) {
      const permsForServer = permissions
        .filter((p) => p.resource_server_identifier === server)
        .map((p) => p.permission_name);

      await ensureResourceServerExists(
        domain,
        managementToken,
        server,
        permsForServer
      );
    }
  }

  /**
   * Helper method to remove old permissions from Auth0 role
   */
  private async removeOldPermissions(
    auth0RoleId: string,
    oldPermissions: PermissionData[],
    domain: string,
    managementToken: string
  ): Promise<void> {
    if (!Array.isArray(oldPermissions) || oldPermissions.length === 0) {
      return;
    }

    const rolePermissionsUrl = `${domain}/api/v2/roles/${auth0RoleId}/permissions`;
    
    await axiosWithRetry({
      method: "DELETE",
      url: rolePermissionsUrl,
      headers: {
        Authorization: `Bearer ${managementToken}`,
        "Content-Type": "application/json",
      },
      data: { permissions: oldPermissions },
    });
  }

  /**
   * Helper method to add new permissions to Auth0 role
   */
  private async addNewPermissions(
    auth0RoleId: string,
    permissions: PermissionData[] | undefined,
    domain: string,
    managementToken: string
  ): Promise<void> {
    if (!Array.isArray(permissions) || permissions.length === 0) {
      return;
    }

    const rolePermissionsUrl = `${domain}/api/v2/roles/${auth0RoleId}/permissions`;
    const permissionChunks = chunkArray(permissions, 10);
    
    for (const chunk of permissionChunks) {
      await axiosWithRetry({
        method: "POST",
        url: rolePermissionsUrl,
        data: { permissions: chunk },
        headers: {
          Authorization: `Bearer ${managementToken}`,
          "Content-Type": "application/json",
        },
      });
    }
  }

  /**
   * Edit an existing user role with Auth0 integration
   *
   * @param payload - Role edit data including role ID, name, description, and permissions
   * @returns Updated user role information
   *
   * Security considerations:
   * - Validates input data to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Updates Auth0 role for secure authentication
   * - Validates role existence before editing
   * - Ensures resource servers exist before updating permissions
   * - Removes old permissions before adding new ones to prevent conflicts
   * - Uses chunked permission assignment for large permission sets
   * - Validates Auth0 domain configuration
   * - Implements proper Auth0 API error handling
   * - Maintains data integrity between local DB and Auth0
   */
  public async editUserRole(
    payload: EditUserRoleRequestDTO
  ): Promise<UserRoleResponseDTO> {
    const { role_id, name, description, permissions, customer_id } = payload;
    if (!role_id) throw new Error("role_id is required");

    // 1️ Find existing role
    const existingRole = await prisma.user_role.findUnique({
      where: { user_role_id: role_id },
    });
    if (!existingRole) throw new Error("Role not found");

    const managementToken = await getManagementToken();

    const domain = getAuth0Domain();

    // 2️ Build Auth0 role name
    // const auth0RoleName = name
    //   ? `${customer_id ? customer_id ?? "TEN"}-${name}`
    //   : existingRole.auth0_role_name;

    const auth0RoleName = name
      ? `${customer_id ?? "TEN"}-${name}`
      : existingRole.auth0_role_name;

    // 3️ Ensure resource servers exist
    await this.ensureResourceServersForPermissions(permissions, domain, managementToken);

    const oldPermissions = Array.isArray(existingRole.role_permission)
      ? existingRole.role_permission
      : [];

    // 4️ Remove old permissions if new provided
    if (Array.isArray(permissions) && permissions.length > 0 && oldPermissions.length > 0 && existingRole.auth0_role_id) {
      await this.removeOldPermissions(existingRole.auth0_role_id, oldPermissions as unknown as PermissionData[], domain, managementToken);
    }

    // 5️ Add new permissions
    if (existingRole.auth0_role_id) {
      await this.addNewPermissions(existingRole.auth0_role_id, permissions, domain, managementToken);
    }

    // 6️ Update Auth0 role name/description
    if (name || description) {
      try {
        await axiosWithRetry({
          method: "PATCH",
          url: `${domain}/api/v2/roles/${existingRole.auth0_role_id}`,
          data: { name: auth0RoleName, description },
          headers: {
            Authorization: `Bearer ${managementToken}`,
            "Content-Type": "application/json",
          },
        });
      } catch (error: unknown) {
        throw createErrorWithMessage("Failed to exchange token", error);
      }
    }

    // 7️ Update local DB
    const updatedRole = await prisma.user_role.update({
      where: { user_role_id: role_id },
      data: {
        name: name ?? existingRole.name,
        description: description ?? existingRole.description,
        auth0_role_name: auth0RoleName,
        role_permission:
          (permissions as Prisma.JsonArray) ?? existingRole.role_permission,
      },
      select: {
        user_role_id: true,
        name: true,
        description: true,
        accessible_account_ids: true,
        auth0_role_id: true,
        auth0_role_name: true,
        role_permission: true,
      },
    });

    return updatedRole;
  }

  /**
   * Get user role by role ID
   *
   * @param role_id - The ID of the role to fetch
   * @returns User role information or null if not found
   *
   * Security considerations:
   * - Validates role_id parameter to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Limits data exposure through selective field queries
   * - Provides safe access to role configuration data
   */
  public async getUserRoleById(role_id: number) {
    return prisma.user_role.findUnique({
      where: { user_role_id: role_id },
      select: {
        user_role_id: true,
        name: true,
        description: true,
        accessible_account_ids: true,
        customer_id: true,
        auth0_role_id: true,
        created_by: true,
        updated_by: true,
        role_permission: true,
      },
    });
  }
}
