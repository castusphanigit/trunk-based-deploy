// src/api/dtos/role.dto.ts

export interface CreateUserRoleDTO {
  name: string;
  description: string;
  customer_id: number;
  permissions: PermissionDTO[]
}

export interface PermissionDTO {
  resource_server_identifier: string;
  permission_name: string
}

export interface RoleFilterQuery {
  name?: string;
  description?: string;
  auth0_role_name?: string;
  created_from?: string;
  created_to?: string;
  sort?: string;
  page?: number | string;
  perPage?: number | string;
  created_at?: string
}

export interface EditUserRoleRequestDTO {
  role_id: number;
  name?: string;
  description?: string;
  permissions?: {
    resource_server_identifier: string,
    permission_name: string
  }[];
  customer_id?: number
}

export interface UserRoleResponseDTO {
  user_role_id: number;
  name: string;
  description: string | null;
  accessible_account_ids: number[];
  auth0_role_id: string | null;
  auth0_role_name: string | null;
  role_permission: any
}
