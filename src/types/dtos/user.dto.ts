import { Prisma } from "@prisma/client";

export interface UserListQueryDTO {
  page: number;
  perPage: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  designation?: string;
  status?: string;
  user_role_id?: number;
  customer_id?: number;
}

export interface UserListItemDTO {
  user_id: number;
  customer_id: number | null;
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
  assigned_account_ids: number[];
  localization_ids: number[];
  localizations: []; // Array of localization_lookup objects
  user_role_ref: {
    user_role_id: number;
    name: string;
    description: string | null;
  } | null;
}

export interface CurrentUserDTO {
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  auth_0_reference_id: string;
  avatar: string | null;
  designation: string | null;
  status: string;
  is_customer_user: boolean;
  created_at: Date;
  assigned_account_ids: number[];
  localization_ids: number[];
  user_role_ref: {
    name: string;
    user_role_id: number;
  } | null;
  customer_ref: {
    customer_id: number;
    customer_name: string;
    reference_number: string;

    _count: {
      accounts: number;
      user: number;
    };
  } | null;
  country_lookup_ref: {
    country_code: string;
    country_name: string | null;
  } | null;
  localizations: Prisma.localization_lookupGetPayload<Record<string, never>>[]; // Array of localization_lookup objects
}

export interface CreateUserDTO {
  first_name: string;
  last_name: string;
  email: string;
  phone_number?: string;
  designation?: string;
  avatar?: string;
  status: "ACTIVE" | "INACTIVE";
  is_customer_user: boolean;
  user_role_id: number;
  customer_id: number;
  password: string;
  assigned_account_ids?: number[];
}

export interface UpdateUserDTO {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  designation?: string;
  avatar?: string;
  status?: "ACTIVE" | "INACTIVE";
  is_customer_user?: boolean;
  user_role_id?: number;
  customer_id?: number;
  password?: string;
  assigned_account_ids?: number[];
}

export interface DeleteUserDTO {
  user_id: number;
}

export interface UserMinimalDTO {
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
  is_customer_user: boolean;
  assigned_account_ids: number[];
  designation: string | null;

  user_role_ref: {
    name: string;
    user_role_id: number;
  } | null;
}

export interface ExtendedUserMinimalDTO extends UserMinimalDTO {
  customer: {
    customer_name?: string | null;
    reference_number?: string | null;
    total_accounts?: number;
  };
}
type ExcludedIdsType = number[] | string | string[];
type StringOrNumber = string | number;
type StringOrBoolean = string | boolean;
type StringOrDate = string | Date;

export interface UserFilterDTO {
  accountIds?: number[] | string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  status?: string;
  is_customer_user?: StringOrBoolean;
  user_role_id?: StringOrNumber;
  page?: StringOrNumber;
  perPage?: StringOrNumber;
  customer_name?: string;
  reference_number?: string;
  customer_account?: string;
  // Date range filters for first_active and last_active
  first_active_from?: StringOrDate;
  first_active_to?: StringOrDate;
  last_active_from?: StringOrDate;
  last_active_to?: StringOrDate;
  designation?: string;
  sort?: string;
  excludedIds?: ExcludedIdsType;
}

export interface UserWithRelations {
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  status: string | null;
  is_customer_user: boolean;
  assigned_account_ids: number[];
  first_active: Date | null;
  last_active: Date | null;
  designation: string | null;
  user_role_id: number | null;
  user_role_ref: { name: string; user_role_id: number } | null;
  customer_ref: {
    customer_name: string | null;
    reference_number: string | null;
    _count: { accounts: number };
  } | null;
}

// dtos/customer.dto.ts
export interface CustomerDTO {
  customer_id: number;
  customer_name: string;
  customer_class: string;
  reference_number: string;
}

// dtos/account.dto.t
export interface AccountDTO {
  account_id: number;
  parent_account_id: number | null;
  account_name: string;
  account_number: string;
  legacy_account_number: string;
  account_type: string;
  account_manager_id: number | null;
  number_of_users: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface AccountWithSelect {
  account_id: number;
  parent_account_id: number | null;
  account_name: string | null;
  account_number: string | null;
  legacy_account_number: string | null;
  account_type: string | null;
  account_manager_id: number | null;
  number_of_users: number | null;
  status: string | null;
  created_at: Date;
  updated_at: Date | null;
}

export interface UserCustomerAccountsResponseDTO {
  customer: CustomerDTO | null;
  accounts: AccountDTO[];
}

export interface CustomerListDTO {
  customer_id: number;
  customer_name: string;
  customer_class: string;
  status: string | null;
  reference_number: string | null;
  sold_by_salesperson_id: number | null;
  is_deleted: boolean;
  deleted_by: number | null;
  deleted_at: Date | null;
  created_at: Date;
  created_by: number | null;
  updated_at: Date | null;
  updated_by: number | null;
}

export interface CustomerFilters {
  customer_id?: number;
  customer_name?: string;
  customer_class?: string;
  status?: string;
  reference_number?: string;
  sold_by_salesperson_id?: number;
  is_deleted?: boolean;
  deleted_by?: number;
  deleted_at?: Date;
  created_at?: Date;
  created_by?: number;
  updated_at?: Date;
  updated_by?: number;
  auth0_customer_id?: string;
  sort?: string; // e.g., "customer_name:asc"
}

// user.dto.ts
export interface GetUsersByCustomerIdQueryDTO {
  user_id?: number;
  customer_id?: number;
  user_role_id?: number;
  country_lookup_id?: number;
  assigned_account_ids?: number[];
  localization_ids?: number[];
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  designation?: string;
  avatar?: string;
  auth_0_reference_id?: string;
  auth0_role_id?: string;
  status?: string;
  is_customer_user?: boolean;
  first_active?: string; // ISO date
  last_active?: string; // ISO date
  created_at?: string;
  created_by?: number;
  updated_at?: string;
  updated_by?: number;
  auth0_customer_id?: string;
  permissions?: Prisma.JsonValue;

  name?: string; // for combined first_name + last_name search
  sort?: string; // e.g., "first_name:asc"
  page?: number;
  perPage?: number;
  customerId?: number;
  excludedIds?: ExcludedIdsType;

  // user_role_name: { user_role_ref: { name: "name" } }
}

export interface UserColumnPreferenceResponseDto {
  user_id: number;
  table_name: string;
  selected_columns: string[];
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserColumnPreferenceDto {
  user_id: number;
  column_preference_table_name_id: number;
  selected_columns: string[];
}

export interface UserColumnPreferenceResponseDto {
  column_preferences_id: string;
  user_id: number;
  column_preference_table_name_id: number;
  selected_columns: string[];
  created_at: Date;
  updated_at: Date;
}

export interface UsersFilterQuery {
  page?: StringOrNumber;
  perPage?: StringOrNumber;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  designation?: string;
  status?: string;
  user_role_id?: StringOrNumber;
  customer_id?: StringOrNumber;
}

export interface CustomerUsersByAccountFilterQuery {
  page?: StringOrNumber;
  perPage?: StringOrNumber;
  accountIds: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  status?: string;
  is_customer_user?: StringOrBoolean;
  user_role_id?: StringOrNumber;
}

export interface CustomersFilterQuery {
  page?: StringOrNumber;
  perPage?: StringOrNumber;

  // Filters
  customer_id?: StringOrNumber;
  customer_name?: string;
  customer_class?: string;
  status?: string;
  reference_number?: string;
  sold_by_salesperson_id?: StringOrNumber;
  created_by?: StringOrNumber;
  updated_by?: StringOrNumber;
  deleted_by?: StringOrNumber;
  deleted_at?: string;
  is_deleted?: boolean;
  auth0_customer_id?: string;
  excludedIds?: ExcludedIdsType;
}

export interface ColumnPreferenceTableNameDto {
  column_preference_table_name_id: number;
  table_name: string;
}

export interface GetUserColumnPreferenceRequest {
  user_id: number;
  column_preference_table_name_id: number;
}

export interface UserColumnPreferenceDto {
  column_preferences_id: number;
  user_id: number;
  column_preference_table_name_id: number;
  selected_columns: string[];
  created_at: Date;
  updated_at: Date;
}

export interface GetSuperAdminRequestDTO {
  customerId: number;
}

// Response DTO
export interface SuperAdminRoleDTO {
  user_role_id: number;
  name: string;
  description?: string | null;
}

export interface SuperAdminUserDTO {
  user_id: number;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  status: string;
}

export interface GetSuperAdminResponseDTO {
  role: SuperAdminRoleDTO;
  user: SuperAdminUserDTO;
}

//

export interface CreateUserInput {
  first_name?: string;
  last_name?: string;
  email: string;
  phone_number?: string;
  designation?: string;
  avatar?: string;
  status?: string;
  is_customer_user: boolean;
  user_role_id: number;
  customer_id: number;
  password: string;
  assigned_account_ids?: number[];
  localization_ids?: number[];
  permissions?: Prisma.JsonValue | null;
}

export interface Auth0User {
  user_id: string;
  email?: string;
}

export interface Auth0ErrorData {
  statusCode?: number;
  errorCode?: string;
  message?: string;
}

export interface UpdateUserVerifyInput {
  is_user_approved: boolean;
  approved_by: number;
}

export interface LocalizationLookupDTO {
  localization_lookup_id: number;
  locale_code: string;
  locale_name: string;
  locale_description: string;
  spelling_vocabulary: string;
  measurement_system: string;
  date_format: string;
  time_format: string;
  currency_code: string;
  currency_symbol: string;
  currency_format: string;
  decimal_separator: string;
  thousands_separator: string;
  temperature_unit: string;
  distance_unit: string;
  weight_unit: string;
  is_active: boolean;
  is_deleted: boolean;
  created_at: Date;
  created_by: number | null;
  updated_at: Date | null;
  updated_by: number | null
}