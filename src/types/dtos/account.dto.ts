import { AccountType } from "@prisma/client";

export interface AccountListItemDTO {
  account_id: number;
  parent_account_id: number | null;
  customer_id: number;
  account_name: string | null;
  account_number: string | null;
  legacy_account_number: string | null;
  account_type: AccountType;
  account_manager_id: number | null;
  number_of_users: number | null;
  status: string | null;
  country_lookup_id: number | null;
  created_at: Date;
  created_by: number | null;
  updated_at: Date | null;
  updated_by: number | null;
  customer?: { customer_name: string | null } | null;
  country_lookup_ref?: { country_name: string | null } | null;
}

export interface AccountMinimalDTO {
  account_id: number;
  account_name: string | null;
  account_number: string | null;
}
export interface UserAssignedDTO {
  user_id: number;
  assigned_account_ids: number[];
  customer_id?: number | null;
}

export interface AccountPrimaryContactDTO {
  user_id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  designation: string | null;
  avatar: string | null;
  status: string | null;
  is_customer_user: boolean | null;
  user_role_ref?: {
    name: string | null;
    description: string | null;
  } | null;
}

export type RelatedAccountRelationship = "parent" | "sibling";

export interface RelatedAccountDTO {
  account_id: number;
  account_name: string | null;
  account_number: string | null;
  legacy_account_number: string | null;
  account_type: string | null;
  status: string | null;
  number_of_users: number | null;
  reference_number: string | null;
  facility: string | null;
  relationship?: RelatedAccountRelationship;
}

export interface AccountHierarchyResponseDTO {
  selectedAccount: {
    account_id: number;
    account_name: string | null;
    account_number: string | null;
    account_type: string | null;
    status: string | null;
    facility: string | null;
    reference_number: string | null;
  };
  primaryContactUser: AccountPrimaryContactDTO | null;
  relatedAccounts: RelatedAccountDTO[];
  summary: {
    has_primary_contact: boolean;
    total_related_accounts: number;
    account_hierarchy_type: "parent" | "child";
  };
}

export interface SecondaryContactDTO {
  user_id: number;
  customer_id: number | null;
  user_role_id: number;
  country_lookup_id: number | null;
  assigned_account_ids: number[];
  first_name: string | null;
  last_name: string | null;

  email: string | null;
  phone_number: string | null;
  designation: string | null;
  avatar: string | null;
  auth_0_reference_id: string;
  auth0_role_id: string | null;
  status: string;
  is_customer_user: boolean;
  first_active: Date | null;
  last_active: Date | null;
  created_at: Date;
  created_by: number | null;
  updated_at: Date | null;
  updated_by: number | null;
  auth0_customer_id: string | null;
  permissions: JSON | null; // Allow null
}

export interface AssignedAccountDropdownItemDTO {
  account_id: number;
  account_name: string | null;
  account_number: string | null;
  is_child: boolean;
  parent_account_id: number | null;
}
