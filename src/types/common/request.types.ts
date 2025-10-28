// Type aliases for union types
type NumberOrString = number | string;
type NumberArrayOrString = number[] | string | string[];

export interface PaginationQuery {
  page?: NumberOrString;
  perPage?: NumberOrString
}

export interface AccountsFilterQuery extends PaginationQuery {
  account_name?: string;
  account_number?: string;
  legacy_account_number?: string;
  account_type?: string;
  account_manager_id?: NumberOrString;
  account_id?: NumberOrString;
  status?: string;
  country_lookup_id?: NumberOrString;
  number_of_users?: NumberOrString;
  is_deleted?: boolean | string;
  sort?: string;
  facility?: string;
  userId?: NumberOrString; // for download only
  excludedIds?: NumberArrayOrString;
  customerId?: number // for download only
}

export interface SecondaryContactsFilterQuery extends PaginationQuery {
  user_id?: NumberOrString;
  name?: string;
  customer_id?: NumberOrString;
  user_role_id?: NumberOrString;
  country_lookup_id?: NumberOrString;

  assigned_account_ids?: NumberOrString; // can handle array in parsing
  first_name?: string;
  last_name?: string;
  email?: string;
  phone_number?: string;
  designation?: string;
  avatar?: string;
  auth_0_reference_id?: string;
  auth0_role_id?: string;
  status?: string;
  is_customer_user?: boolean | string;
  first_active?: string;
  last_active?: string;
  created_at?: string;
  created_by?: NumberOrString;
  updated_at?: string;
  updated_by?: NumberOrString;
  auth0_customer_id?: string;
  permissions?: string; // JSON, can only filter by contains or ignore
  sort?: string; // e.g. "first_name:asc,last_name:desc"
  excludedIds?: NumberArrayOrString;
  accountId: number
}

export interface ColumnDefinition {
  label: string;
  field: string
}

export interface InvoicesFilterQuery extends PaginationQuery {
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  accountIds?: NumberArrayOrString;
  invoiceType?: string;
  sort?: string;
  excludedIds?: NumberArrayOrString;
  status?: string
}

export interface PaymentsFilterQuery extends PaginationQuery {
  paymentId?: string;
  paymentDate?: string;
  paymentMethod?: string;
  accountIds?: NumberArrayOrString;
  invoices?: NumberOrString; // invoice id foreign key
  sort?: string;
  excludedIds?: NumberArrayOrString;
  status?: string
}
