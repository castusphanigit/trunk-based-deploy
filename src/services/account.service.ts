/**
 * Account Service
 *
 * Handles business logic for account-related operations including:
 * - Account CRUD operations with proper authorization
 * - Account hierarchy management
 * - Secondary contact management
 * - Excel export functionality with data sanitization
 * - Pagination and filtering with security considerations
 *
 * Security considerations:
 * - All database queries use parameterized queries (Prisma ORM)
 * - Input validation and sanitization
 * - Authorization checks for data access
 * - SQL injection prevention through ORM
 * - Data sanitization for exports
 * - Proper error handling without information disclosure
 *
 * @author kalyanrai
 * @version 1.0.0
 */

import prisma from "../config/database.config";
import { getPagination } from "../utils/pagination";
import {
  AccountHierarchyResponseDTO,
  AccountListItemDTO,
  AccountMinimalDTO,
  AccountPrimaryContactDTO,
  AssignedAccountDropdownItemDTO,
  RelatedAccountDTO,
  RelatedAccountRelationship,
  SecondaryContactDTO,
  UserAssignedDTO,
} from "../types/dtos/account.dto";
import {
  AccountsFilterQuery,
  ColumnDefinition,
  SecondaryContactsFilterQuery,
} from "../types/common/request.types";
import { ExcelExporter } from "../utils/excelUtils";
import { buildOrderByFromSort } from "../utils/sort";
import {
  ACCOUNT_SORT_FIELDS,
  USER_SORT_FIELDS,
} from "../types/sorts/sortTypes";
import path from "path";
import fs from "fs";
import { Prisma, AccountType } from "@prisma/client";
import { createErrorWithMessage } from "../utils/responseUtils";

export class AccountService {
  private toBool(val: unknown, fallback = false): boolean {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") return val.toLowerCase() === "true";
    return fallback;
  }

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

  private async getUserCountForAccount(accountId: number): Promise<number> {
    return await prisma.user.count({
      where: {
        assigned_account_ids: { has: accountId },
      },
    });
  }

  private buildCommonAccountFilters(
    assignedAccountIds: number[],
    query: AccountsFilterQuery,
    excludedIds: number[] = []
  ): Prisma.accountWhereInput {
    const filters: Prisma.accountWhereInput = {
      account_id: { in: assignedAccountIds },
      ...(typeof query.is_deleted !== "undefined"
        ? { is_deleted: this.toBool(query.is_deleted) }
        : { is_deleted: false }),
      ...(query.account_name && {
        account_name: {
          contains: query.account_name,
          mode: "insensitive",
        },
      }),
      ...(query.account_number && {
        account_number: {
          contains: query.account_number,
          mode: "insensitive",
        },
      }),
      ...(query.account_type && {
        account_type: query.account_type as AccountType,
      }),
      ...(query.status &&
        query.status !== "All" && {
          status: {
            contains: query.status,
            mode: Prisma.QueryMode.insensitive,
          },
        }),
      ...(query.country_lookup_id && {
        country_lookup_id: Number(query.country_lookup_id),
      }),
      ...(query.account_manager_id && {
        account_manager_id: Number(query.account_manager_id),
      }),
      ...(excludedIds.length > 0 && { account_id: { notIn: excludedIds } }),
    };

    return filters;
  }

  private buildUserAccountFilters(
    assignedAccountIds: number[],
    query: AccountsFilterQuery
  ): Prisma.accountWhereInput {
    const filters: Prisma.accountWhereInput = {
      account_id: { in: assignedAccountIds },
      ...(typeof query.is_deleted !== "undefined"
        ? { is_deleted: this.toBool(query.is_deleted) }
        : { is_deleted: false }),
    };

    // Apply specific account filter if requested
    if (query.account_id) {
      const requestedAccountId = Number(query.account_id);
      if (assignedAccountIds.includes(requestedAccountId)) {
        filters.account_id = requestedAccountId;
      } else {
        filters.account_id = { in: [] }; // Return no records
      }
    }

    // Apply text-based filters
    if (query.account_name) {
      filters.account_name = {
        contains: query.account_name,
        mode: "insensitive",
      };
    }

    if (query.account_number) {
      filters.account_number = {
        contains: query.account_number,
        mode: "insensitive",
      };
    }

    if (query.legacy_account_number) {
      filters.legacy_account_number = {
        contains: query.legacy_account_number,
        mode: "insensitive",
      };
    }

    // Apply enum and numeric filters
    if (query.account_type) {
      filters.account_type = query.account_type as AccountType;
    }

    if (query.status && query.status !== "All") {
      filters.status = { equals: query.status, mode: "insensitive" };
    }

    if (query.country_lookup_id) {
      filters.country_lookup_id = Number(query.country_lookup_id);
    }

    if (query.account_manager_id) {
      filters.account_manager_id = Number(query.account_manager_id);
    }

    if (query.number_of_users) {
      filters.number_of_users = Number(query.number_of_users);
    }

    if (query.facility) {
      filters.facility = {
        equals: query.facility,
        mode: "insensitive",
      };
    }

    return filters;
  }

  private async addAccountCounts(
    accounts: AccountListItemDTO[]
  ): Promise<AccountListItemDTO[]> {
    return Promise.all(
      accounts.map(async (acc) => {
        // Count users assigned to this account
        const userCount = await this.getUserCountForAccount(acc.account_id);

        let relatedCount = 0;

        if (acc.parent_account_id === null) {
          // Case 1: Parent account → count children
          relatedCount = await prisma.account.count({
            where: {
              parent_account_id: acc.account_id,
            },
          });
        } else {
          // Case 2: Child account → count siblings under the same parent (excluding itself)
          relatedCount = await prisma.account.count({
            where: {
              parent_account_id: acc.parent_account_id,
              account_id: { not: acc.account_id },
            },
          });
        }

        return {
          ...acc,
          user_count: userCount,
          related_account_count: relatedCount,
        };
      })
    );
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
    } else {
      return {
        OR: [
          { first_name: { contains: name, mode: "insensitive" } },
          { last_name: { contains: name, mode: "insensitive" } },
        ],
      };
    }
  }

  private applyBasicTextFilters(
    whereClause: Prisma.userWhereInput,
    query: SecondaryContactsFilterQuery
  ): void {
    if (query.first_name) {
      whereClause.first_name = {
        contains: query.first_name,
        mode: "insensitive",
      };
    }

    if (query.last_name) {
      whereClause.last_name = {
        contains: query.last_name,
        mode: "insensitive",
      };
    }

    if (query.email) {
      whereClause.email = {
        contains: query.email,
        mode: "insensitive",
      };
    }

    if (query.phone_number) {
      whereClause.phone_number = {
        contains: query.phone_number,
        mode: "insensitive",
      };
    }

    if (query.designation) {
      whereClause.designation = {
        contains: query.designation,
        mode: "insensitive",
      };
    }
  }

  private applyAuthTextFilters(
    whereClause: Prisma.userWhereInput,
    query: SecondaryContactsFilterQuery
  ): void {
    if (query.avatar) {
      whereClause.avatar = {
        contains: query.avatar,
        mode: "insensitive",
      };
    }

    if (query.auth_0_reference_id) {
      whereClause.auth_0_reference_id = {
        contains: query.auth_0_reference_id,
        mode: "insensitive",
      };
    }

    if (query.auth0_role_id) {
      whereClause.auth0_role_id = {
        contains: query.auth0_role_id,
        mode: "insensitive",
      };
    }

    if (query.auth0_customer_id) {
      whereClause.auth0_customer_id = {
        contains: query.auth0_customer_id,
        mode: "insensitive",
      };
    }
  }

  private applyNumericFilters(
    whereClause: Prisma.userWhereInput,
    query: SecondaryContactsFilterQuery
  ): void {
    if (query.customer_id) {
      whereClause.customer_id = Number(query.customer_id);
    }

    if (query.user_role_id) {
      whereClause.user_role_id = Number(query.user_role_id);
    }

    if (query.country_lookup_id) {
      whereClause.country_lookup_id = Number(query.country_lookup_id);
    }

    if (query.status && query.status !== "All") {
      whereClause.status = {
        contains: query.status,
        mode: Prisma.QueryMode.insensitive,
      };
    }

    if (query.is_customer_user !== undefined) {
      whereClause.is_customer_user =
        query.is_customer_user === "true" || query.is_customer_user === true;
    }

    if (query.created_by) {
      whereClause.created_by = Number(query.created_by);
    }

    if (query.updated_by) {
      whereClause.updated_by = Number(query.updated_by);
    }
  }

  private applyDateFilters(
    whereClause: Prisma.userWhereInput,
    query: SecondaryContactsFilterQuery
  ): void {
    if (query.first_active) {
      whereClause.first_active = new Date(query.first_active);
    }

    if (query.last_active) {
      whereClause.last_active = new Date(query.last_active);
    }

    if (query.created_at) {
      whereClause.created_at = new Date(query.created_at);
    }

    if (query.updated_at) {
      whereClause.updated_at = new Date(query.updated_at);
    }
  }

  private buildAccountExcelColumns(requestedColumns: ColumnDefinition[]) {
    return requestedColumns.map(({ label, field }) => {
      switch (field) {
        case "sno":
          return { header: label, key: field, width: 8 };
        case "is_deleted":
          return {
            header: label,
            key: field,
            width: 12,
            formatter: (val: unknown) => (val ? "Yes" : "No"),
          };
        case "created_at":
        case "updated_at":
          return {
            header: label,
            key: field,
            width: 20,
            formatter: (val: unknown) =>
              val ? new Date(val as Date).toLocaleString() : "N/A",
          };
        case "customer_name":
          return {
            header: label,
            key: field,
            width: 25,
            formatter: (acc: unknown) =>
              (acc as { customer?: { customer_name?: string } }).customer
                ?.customer_name ?? "N/A",
          };
        case "country":
          return {
            header: label,
            key: field,
            width: 15,
            formatter: (acc: unknown) =>
              (acc as { country_lookup_ref?: { country_name?: string } })
                .country_lookup_ref?.country_name ?? "N/A",
          };
        default:
          return { header: label, key: field, width: 20 };
      }
    });
  }

  private buildSecondaryContactExcelColumns(
    requestedColumns: ColumnDefinition[]
  ) {
    return requestedColumns.map(({ label, field }) => {
      switch (field) {
        case "sno":
          return { header: label, key: field, width: 8 };
        case "status":
          return {
            header: label,
            key: field,
            width: 15,
            formatter: (val: unknown) => (val as string) ?? "N/A",
          };
        case "created_at":
        case "updated_at":
          return {
            header: label,
            key: field,
            width: 20,
            formatter: (val: unknown) =>
              val ? new Date(val as Date | string).toLocaleString() : "N/A",
          };
        default:
          return { header: label, key: field, width: 20 };
      }
    });
  }

  private formatAccountDataForExcel(
    accounts: AccountListItemDTO[],
    requestedColumns: ColumnDefinition[]
  ): Record<string, unknown>[] {
    return accounts.map((acc, index) => {
      const row: Record<string, unknown> = {};

      requestedColumns.forEach(({ field }) => {
        if (field === "sno") {
          row[field] = index + 1;
        } else if (field in acc) {
          row[field] = acc[field as keyof AccountListItemDTO] ?? "";
        } else {
          row[field] = "";
        }
      });

      return row;
    });
  }

  private formatSecondaryContactDataForExcel(
    users: SecondaryContactDTO[],
    requestedColumns: ColumnDefinition[]
  ): Record<string, string | number>[] {
    return users.map((user, index) => {
      const row: Record<string, string | number> = {};

      requestedColumns.forEach(({ field }) => {
        if (field === "sno") {
          row[field] = index + 1;
        } else if (field === "name") {
          row[field] = `${user.first_name ?? ""} ${
            user.last_name ?? ""
          }`.trim();
        } else if (field in user) {
          const key = field as keyof SecondaryContactDTO;
          const value = user[key];
          row[field] = this.formatValueForExcel(value);
        } else {
          row[field] = "";
        }
      });

      return row;
    });
  }

  private formatValueForExcel(value: unknown): string | number {
    if (value === undefined || value === null) {
      return "";
    }
    if (typeof value === "string" || typeof value === "number") {
      return value;
    }
    if (value instanceof Date) {
      return value.toLocaleString();
    }
    if (Array.isArray(value)) {
      return value.join(", ");
    }
    if (typeof value === "boolean") {
      return value ? 1 : 0;
    }
    return JSON.stringify(value);
  }

  private async generateAndSaveExcelFile(
    exporter: ExcelExporter,
    filename: string
  ): Promise<Buffer> {
    const buffer = await exporter.writeToBuffer();

    return buffer;
  }

  private async generateExcelFile(
    sheetName: string,
    columns: {
      header: string;
      key: string;
      width?: number;
      formatter?: (value: unknown) => unknown;
    }[],
    data: Record<string, unknown>[],
    filename: string
  ): Promise<{ buffer: Buffer; filename: string }> {
    const exporter = new ExcelExporter();
    exporter.generateWorkbook({
      sheetName,
      columns,
      data,
      filename,
    });

    const buffer = await this.generateAndSaveExcelFile(exporter, filename);
    return { buffer, filename };
  }

  private buildCustomerAccountFilters(
    customerId: number,
    query: AccountsFilterQuery & { excludedIds?: number[] }
  ): Prisma.accountWhereInput {
    return {
      customer_id: customerId,
      is_deleted: false,
      ...(query.account_name && {
        account_name: {
          contains: query.account_name,
          mode: "insensitive",
        },
      }),
      ...(query.account_number && {
        account_number: {
          contains: query.account_number,
          mode: "insensitive",
        },
      }),
      ...(query.legacy_account_number && {
        legacy_account_number: {
          contains: query.legacy_account_number,
          mode: "insensitive",
        },
      }),
      ...(query.account_type && {
        account_type: query.account_type as AccountType,
      }),
      ...(query.account_manager_id && {
        account_manager_id: Number(query.account_manager_id),
      }),
      ...(query.status &&
        query.status !== "All" && {
          status: {
            contains: query.status,
            mode: Prisma.QueryMode.insensitive,
          },
        }),
      ...(query.country_lookup_id && {
        country_lookup_id: Number(query.country_lookup_id),
      }),
      ...(query.facility && {
        facility: { contains: query.facility, mode: "insensitive" },
      }),
      ...(query.excludedIds?.length
        ? { account_id: { notIn: query.excludedIds } }
        : {}),
    };
  }

  private validateUserId(userId: unknown): number {
    const numericUserId = Number(userId);
    if (
      !numericUserId ||
      numericUserId <= 0 ||
      !Number.isInteger(numericUserId)
    ) {
      throw createErrorWithMessage("Invalid user ID provided", "", 400);
    }
    return numericUserId;
  }

  private async fetchUserForDownload(userId: number) {
    const user = await prisma.user.findFirst({
      where: { user_id: userId },
      select: {
        user_id: true,
        customer_id: true,
        assigned_account_ids: true,
      },
    });

    if (!user) {
      throw createErrorWithMessage("User not found", "", 404);
    }

    return user;
  }

  private processAssignedAccountIds(
    user: { assigned_account_ids?: number[] | null },
    query: AccountsFilterQuery
  ): number[] {
    let assignedAccountIds: number[] = user.assigned_account_ids ?? [];
    const excludedIds: number[] = this.parseExcludedIds(query.excludedIds);

    if (excludedIds.length > 0) {
      assignedAccountIds = assignedAccountIds.filter(
        (id) => !excludedIds.includes(id)
      );
    }

    return assignedAccountIds;
  }

  private buildUserAccountFiltersForDownload(
    assignedAccountIds: number[],
    query: AccountsFilterQuery
  ): Prisma.accountWhereInput {
    return assignedAccountIds.length > 0
      ? this.buildCommonAccountFilters(assignedAccountIds, query, [])
      : { account_id: { in: [] } };
  }

  private async fetchAccountsForDownload(
    filters: Prisma.accountWhereInput,
    query: AccountsFilterQuery
  ): Promise<AccountListItemDTO[]> {
    return (await prisma.account.findMany({
      where: filters,
      orderBy: buildOrderByFromSort(
        query.sort,
        ACCOUNT_SORT_FIELDS,
        "account_id"
      ),
      select: {
        account_id: true,
        parent_account_id: true,
        customer_id: true,
        account_name: true,
        account_number: true,
        account_type: true,
        account_manager_id: true,
        number_of_users: true,
        status: true,
        is_deleted: true,
        created_at: true,
        updated_at: true,
        legacy_account_number: true,
        facility: true,
        country_lookup_id: true,
        created_by: true,
        updated_by: true,
        customer: { select: { customer_name: true } },
        country_lookup_ref: { select: { country_name: true } },
      },
    })) as AccountListItemDTO[];
  }

  private generateUserAccountsFilename(userId: number): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    return `user_${userId}_accounts_${timestamp}.xlsx`;
  }

  private async validateAccountForDownload(accountId: number): Promise<void> {
    const account = await prisma.account.findUnique({
      where: { account_id: accountId },
      select: { account_id: true, account_name: true },
    });

    if (!account) {
      throw createErrorWithMessage("Account not found", "", 404);
    }
  }

  private async fetchSecondaryContactsForDownload(
    whereClause: Prisma.userWhereInput,
    orderBy: Record<string, unknown>[]
  ): Promise<SecondaryContactDTO[]> {
    return (await prisma.user.findMany({
      where: whereClause,
      orderBy: orderBy as Prisma.userOrderByWithRelationInput[],
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        email: true,
        designation: true,
        status: true,
        phone_number: true,
        created_at: true,
        updated_at: true,
      },
    })) as SecondaryContactDTO[];
  }

  private generateSecondaryContactsFilename(): string {
    return `SecondaryContacts_${Date.now()}.xlsx`;
  }

  private async fetchCustomerAccountsForDownload(
    filters: Prisma.accountWhereInput,
    orderBy: Record<string, unknown>[]
  ): Promise<AccountListItemDTO[]> {
    return (await prisma.account.findMany({
      where: filters,
      orderBy: orderBy as Prisma.accountOrderByWithRelationInput[],
      select: {
        account_id: true,
        parent_account_id: true,
        customer_id: true,
        account_name: true,
        account_number: true,
        legacy_account_number: true,
        account_type: true,
        account_manager_id: true,
        number_of_users: true,
        status: true,
        is_deleted: true,
        created_at: true,
        updated_at: true,
        facility: true,
        country_lookup_id: true,
        created_by: true,
        updated_by: true,
        customer: { select: { customer_name: true } },
        country_lookup_ref: { select: { country_name: true } },
      },
    })) as AccountListItemDTO[];
  }

  private async addUserCountsToAccounts(
    accounts: AccountListItemDTO[]
  ): Promise<(AccountListItemDTO & { user_count: number })[]> {
    return await Promise.all(
      accounts.map(async (acc) => {
        const userCount = await this.getUserCountForAccount(acc.account_id);
        return { ...acc, user_count: userCount };
      })
    );
  }

  private formatFieldValueForExcel(
    field: string,
    value: unknown,
    acc: AccountListItemDTO & { user_count: number }
  ): string | number {
    if (value === null || value === undefined) {
      return "";
    }

    if (field === "account_name") {
      return `${acc.account_name ?? ""} (${acc.account_number ?? ""})`;
    }

    if (typeof value === "string" || typeof value === "number") {
      return value;
    }

    if (value instanceof Date) {
      return value.toLocaleString();
    }

    if (Array.isArray(value)) {
      return value.join(", ");
    }

    return JSON.stringify(value);
  }

  private formatCustomerAccountDataForExcel(
    accounts: (AccountListItemDTO & { user_count: number })[],
    requestedColumns: ColumnDefinition[]
  ): Record<string, string | number>[] {
    return accounts.map((acc, index) => {
      const row: Record<string, string | number> = {};

      requestedColumns.forEach(({ field }) => {
        if (field === "sno") {
          row[field] = index + 1;
        } else if (field in acc) {
          const key = field as keyof typeof acc;
          const value = acc[key];
          row[field] = this.formatFieldValueForExcel(field, value, acc);
        } else {
          row[field] = "";
        }
      });

      return row;
    });
  }

  private generateCustomerAccountsFilename(): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    return `customer_Accounts_${timestamp}.xlsx`;
  }

  private buildSecondaryContactFilters(
    accountId: number,
    query: SecondaryContactsFilterQuery
  ): Prisma.userWhereInput {
    const whereClause: Prisma.userWhereInput = {
      assigned_account_ids: { has: accountId },
    };

    // Apply name filter
    if (query.name) {
      Object.assign(whereClause, this.buildNameFilter(query.name));
    }

    // Apply different types of filters
    this.applyBasicTextFilters(whereClause, query);
    this.applyAuthTextFilters(whereClause, query);
    this.applyNumericFilters(whereClause, query);
    this.applyDateFilters(whereClause, query);

    return whereClause;
  }

  public async fetchAccountsOfCustomer(
    customerId: number,
    query: AccountsFilterQuery
  ): Promise<{
    data: AccountListItemDTO[];
    total: number;
    page: number;
    perPage: number;
  }> {
    try {
      // Input validation - prevent injection attacks
      if (!customerId || customerId <= 0 || !Number.isInteger(customerId)) {
        throw createErrorWithMessage("Invalid customer ID provided", "", 400);
      }

      const { page, perPage, skip, take } = getPagination(query);

      // Build the filters object using the existing helper method
      const filters = this.buildCustomerAccountFilters(customerId, {
        ...query,
        excludedIds: this.parseExcludedIds(query.excludedIds),
      });

      const orderBy = buildOrderByFromSort(
        query.sort,
        ACCOUNT_SORT_FIELDS,
        "account_id"
      );

      const total = await prisma.account.count({ where: filters });
      const accounts: AccountListItemDTO[] = await prisma.account.findMany({
        skip,
        take,
        where: filters,
        orderBy,
        select: {
          account_id: true,
          parent_account_id: true,
          customer_id: true,
          account_name: true,
          account_number: true,
          legacy_account_number: true,
          account_type: true,
          account_manager_id: true,
          number_of_users: true,
          status: true,
          is_deleted: true,
          deleted_by: true,
          deleted_at: true,
          created_at: true,
          created_by: true,
          updated_at: true,
          updated_by: true,
          customer: { select: { customer_name: true } },
          country_lookup_ref: { select: { country_name: true } },
          country_lookup_id: true,
          facility: true,
        },
      });

      const accountWithCounts = await this.addAccountCounts(accounts);

      return { data: accountWithCounts, total, page, perPage };
    } catch (error: unknown) {
      throw createErrorWithMessage("Failed to fetch accounts", error);
    }
  }

  public async getAccountsByUserId(
    userId: number,
    query: AccountsFilterQuery
  ): Promise<{
    data: AccountListItemDTO[];
    total: number;
    page: number;
    perPage: number;
  }> {
    try {
      // Input validation - prevent injection attacks
      if (!userId || userId <= 0 || !Number.isInteger(userId)) {
        throw createErrorWithMessage("Invalid user ID provided", "", 400);
      }

      const { page, perPage, skip, take } = getPagination(query);

      // Get user and their assigned account IDs with proper authorization
      const user = await prisma.user.findFirst({
        where: { user_id: userId },
        select: {
          user_id: true,
          customer_id: true,
          assigned_account_ids: true,
        },
      });

      if (!user) {
        throw createErrorWithMessage("USER_NOT_FOUND", "", 404);
      }

      const assignedAccountIds = user.assigned_account_ids ?? [];
      if (assignedAccountIds.length === 0) {
        return { data: [], total: 0, page, perPage };
      }

      // Build filters using helper method
      const filters = this.buildUserAccountFilters(assignedAccountIds, query);

      // Check if filters result in no records (e.g., unauthorized account access)
      if (
        filters.account_id &&
        typeof filters.account_id === "object" &&
        "in" in filters.account_id &&
        Array.isArray(filters.account_id.in) &&
        filters.account_id.in.length === 0
      ) {
        return { data: [], total: 0, page, perPage };
      }

      const orderBy = buildOrderByFromSort(
        query.sort,
        ACCOUNT_SORT_FIELDS,
        "account_id"
      );

      // Get total count with filters applied
      const total = await prisma.account.count({ where: filters });

      // Get paginated results with all filters applied
      const accounts: AccountListItemDTO[] = await prisma.account.findMany({
        where: filters,
        skip,
        take,
        orderBy,
        select: {
          account_id: true,
          parent_account_id: true,
          customer_id: true,
          account_name: true,
          account_number: true,
          legacy_account_number: true,
          account_type: true,
          account_manager_id: true,
          number_of_users: true,
          status: true,
          is_deleted: true,
          deleted_by: true,
          deleted_at: true,
          created_at: true,
          created_by: true,
          updated_at: true,
          updated_by: true,
          customer: { select: { customer_name: true } },
          country_lookup_ref: { select: { country_name: true } },
          country_lookup_id: true,
          facility: true,
        },
      });

      // Add counts using helper method
      const accountWithCounts = await this.addAccountCounts(accounts);

      return { data: accountWithCounts, total, page, perPage };
    } catch (error: unknown) {
      throw createErrorWithMessage("Failed to fetch accounts", error);
    }
  }

  public async getSecondaryContacts(
    accountId: number,
    query: SecondaryContactsFilterQuery
  ): Promise<{
    data: SecondaryContactDTO[];
    total: number;
    page: number;
    perPage: number;
  }> {
    try {
      const { page, perPage, skip, take } = getPagination(query);

      // Build filters using helper method
      const whereClause = this.buildSecondaryContactFilters(accountId, query);

      const orderBy = buildOrderByFromSort(
        query.sort,
        USER_SORT_FIELDS,
        "user_id"
      );

      const total = await prisma.user.count({ where: whereClause });

      const users = (await prisma.user.findMany({
        where: whereClause,
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
        },
      })) as SecondaryContactDTO[];

      return { data: users, total, page, perPage };
    } catch (error: unknown) {
      throw createErrorWithMessage("Failed to fetch secondary contacts", error);
    }
  }

  public async getAccountPrimaryContactAndRelated(
    accountId: number,
    customerId?: number
  ): Promise<AccountHierarchyResponseDTO> {
    try {
      const selectedAccount = await prisma.account.findFirst({
        where: {
          account_id: accountId,
          ...(customerId && { customer_id: customerId }),
          is_deleted: false,
        },
        select: {
          account_id: true,
          parent_account_id: true,
          customer_id: true,
          account_name: true,
          account_number: true,
          legacy_account_number: true,
          account_type: true,
          primary_contact_user_id: true,
          status: true,
          facility: true,
          customer: {
            select: {
              reference_number: true,
              // address: true,
            },
          },
        },
      });

      if (!selectedAccount) {
        throw createErrorWithMessage("Account not found", "", 404);
      }

      let primaryContactUser: AccountPrimaryContactDTO | null = null;
      if (selectedAccount.primary_contact_user_id) {
        primaryContactUser = await prisma.user.findUnique({
          where: { user_id: selectedAccount.primary_contact_user_id },
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
            user_role_ref: { select: { name: true, description: true } },

            customer_ref: {
              select: {
                customer_name: true,
                reference_number: true,
                address: true,
              },
            },
          },
        });
      }

      let relatedAccounts: RelatedAccountDTO[];

      if (selectedAccount.parent_account_id === null) {
        const childAccounts = await prisma.account.findMany({
          where: {
            parent_account_id: selectedAccount.account_id,
            is_deleted: false,
          },
          select: {
            account_id: true,
            account_name: true,
            account_number: true,
            legacy_account_number: true,
            account_type: true,
            status: true,
            number_of_users: true,
            facility: true,

            customer: {
              select: {
                reference_number: true,
              },
            },
          },
          orderBy: { account_id: "asc" },
        });

        relatedAccounts = childAccounts.map(
          (a): RelatedAccountDTO => ({
            account_id: a.account_id,
            account_name: a.account_name,
            account_number: a.account_number,
            legacy_account_number: a.legacy_account_number,
            account_type: a.account_type,
            status: a.status,
            facility: a.facility,
            number_of_users: a.number_of_users,
            reference_number: a.customer?.reference_number || null,
          })
        );
      } else {
        const [parentAccount, siblingAccounts] = await Promise.all([
          prisma.account.findUnique({
            where: { account_id: selectedAccount.parent_account_id },
            select: {
              account_id: true,
              account_name: true,
              account_number: true,
              legacy_account_number: true,
              account_type: true,
              status: true,
              number_of_users: true,
              facility: true,
              customer: {
                select: {
                  reference_number: true,
                },
              },
            },
          }),
          prisma.account.findMany({
            where: {
              parent_account_id: selectedAccount.parent_account_id,
              account_id: { not: selectedAccount.account_id },
              is_deleted: false,
            },
            select: {
              account_id: true,
              account_name: true,
              account_number: true,
              legacy_account_number: true,
              account_type: true,
              status: true,
              number_of_users: true,
              facility: true,
              customer: {
                select: {
                  reference_number: true,
                },
              },
            },
            orderBy: { account_id: "asc" },
          }),
        ]);

        relatedAccounts = [
          ...(parentAccount
            ? [
                {
                  account_id: parentAccount.account_id,
                  account_name: parentAccount.account_name,
                  account_number: parentAccount.account_number,
                  legacy_account_number: parentAccount.legacy_account_number,
                  account_type: parentAccount.account_type,
                  status: parentAccount.status,
                  number_of_users: parentAccount.number_of_users,
                  reference_number:
                    parentAccount.customer?.reference_number || null,
                  facility: parentAccount.facility,
                  relationship: "parent" as RelatedAccountRelationship,
                },
              ]
            : []),
          ...siblingAccounts.map(
            (a): RelatedAccountDTO => ({
              account_id: a.account_id,
              account_name: a.account_name,
              account_number: a.account_number,
              legacy_account_number: a.legacy_account_number,
              account_type: a.account_type,
              status: a.status,
              number_of_users: a.number_of_users,
              reference_number: a.customer?.reference_number || null,
              facility: a.facility,
              relationship: "sibling" as RelatedAccountRelationship,
            })
          ),
        ];
      }

      return {
        selectedAccount: {
          account_id: selectedAccount.account_id,
          account_name: selectedAccount.account_name,
          account_number: selectedAccount.account_number,
          account_type: selectedAccount.account_type,
          status: selectedAccount.status,
          facility: selectedAccount.facility,
          reference_number: selectedAccount.customer?.reference_number || null,
        },
        primaryContactUser,
        relatedAccounts,
        summary: {
          has_primary_contact: !!primaryContactUser,
          total_related_accounts: relatedAccounts.length,
          account_hierarchy_type: selectedAccount.parent_account_id
            ? "child"
            : "parent",
        },
      };
    } catch (error: unknown) {
      throw createErrorWithMessage("Failed to fetch account hierarchy", error);
    }
  }

  public async getUserAccountsMinimal(
    userId: number
  ): Promise<AccountMinimalDTO[]> {
    try {
      const rawUser = await prisma.user.findFirst({
        where: { user_id: userId },
      });

      if (!rawUser) return [];

      function mapToUserAssignedDTO(
        dbResult: typeof rawUser
      ): UserAssignedDTO | null {
        if (!dbResult) return null;
        return {
          user_id: dbResult.user_id,
          assigned_account_ids: dbResult.assigned_account_ids ?? [],
          customer_id: dbResult.customer_id,
        };
      }

      const user = mapToUserAssignedDTO(rawUser);
      if (!user) return [];

      const accounts: AccountMinimalDTO[] = await prisma.account.findMany({
        where: {
          account_id: { in: user.assigned_account_ids },
          ...(user.customer_id && { customer_id: user.customer_id }),
          is_deleted: false,
        },
        select: { account_id: true, account_name: true, account_number: true },
        orderBy: { account_id: "asc" },
      });

      return accounts;
    } catch (error: unknown) {
      throw createErrorWithMessage("Failed to fetch accounts", error);
    }
  }

  public async fetchAssignedAccountsDropdown(
    customerId: number
  ): Promise<AssignedAccountDropdownItemDTO[]> {
    const customer = await prisma.customer.findUnique({
      where: { customer_id: customerId },
      select: { customer_id: true },
    });

    if (!customer) {
      throw createErrorWithMessage("Customer not found", "", 404);
    }

    const accounts = await prisma.account.findMany({
      where: { customer_id: customerId, is_deleted: false },
      orderBy: { account_name: "asc" },
      select: {
        account_id: true,
        account_name: true,
        parent_account_id: true,
        account_number: true,
      },
    });

    return accounts.map((acc) => ({
      account_id: acc.account_id,
      account_name: acc.account_name,
      account_number: acc.account_number,
      is_child: acc.parent_account_id !== null,
      parent_account_id: acc.parent_account_id ?? null,
    }));
  }

  public async downloadAccountsByUserId(
    query: AccountsFilterQuery,
    requestedColumns: ColumnDefinition[]
  ): Promise<{ buffer: Buffer; filename: string }> {
    // Input validation and user fetch
    const userId = this.validateUserId(query.userId);
    const user = await this.fetchUserForDownload(userId);
    const assignedAccountIds = this.processAssignedAccountIds(user, query);

    // Build filters and fetch accounts
    const filters = this.buildUserAccountFiltersForDownload(
      assignedAccountIds,
      query
    );
    const accounts = await this.fetchAccountsForDownload(filters, query);
    const accountWithCounts = await this.addAccountCounts(accounts);

    // Generate Excel file
    const columns = this.buildAccountExcelColumns(requestedColumns);
    const formattedData = this.formatAccountDataForExcel(
      accountWithCounts,
      requestedColumns
    );
    const filename = this.generateUserAccountsFilename(userId);

    return await this.generateExcelFile(
      "User Accounts",
      columns,
      formattedData,
      filename
    );
  }

  public async downloadSecondaryContacts(
    accountId: number,
    query: SecondaryContactsFilterQuery,
    requestedColumns: ColumnDefinition[]
  ): Promise<{ buffer: Buffer; filename: string }> {
    // Validate account and build filters
    await this.validateAccountForDownload(accountId);
    const whereClause = this.buildSecondaryContactFilters(accountId, query);
    const orderBy = buildOrderByFromSort(
      query.sort,
      USER_SORT_FIELDS,
      "user_id"
    );

    // Fetch users
    const users = await this.fetchSecondaryContactsForDownload(
      whereClause,
      orderBy
    );

    // Generate Excel file
    const columns = this.buildSecondaryContactExcelColumns(requestedColumns);
    const formattedData = this.formatSecondaryContactDataForExcel(
      users,
      requestedColumns
    );
    const filename = this.generateSecondaryContactsFilename();

    return await this.generateExcelFile(
      "Secondary Contacts",
      columns,
      formattedData,
      filename
    );
  }

  public async downloadAccountsOfCustomer(
    customerId: number,
    query: AccountsFilterQuery & { excludedIds?: number[] },
    requestedColumns: ColumnDefinition[]
  ): Promise<{ buffer: Buffer; filename: string }> {
    // Build filters and fetch accounts
    const filters = this.buildCustomerAccountFilters(customerId, query);
    const orderBy = buildOrderByFromSort(
      query.sort,
      ACCOUNT_SORT_FIELDS,
      "account_id"
    );
    const accounts = await this.fetchCustomerAccountsForDownload(
      filters,
      orderBy
    );
    const accountWithCounts = await this.addUserCountsToAccounts(accounts);

    // Generate Excel file
    const columns = this.buildAccountExcelColumns(requestedColumns);
    const formattedData = this.formatCustomerAccountDataForExcel(
      accountWithCounts,
      requestedColumns
    );
    const filename = this.generateCustomerAccountsFilename();

    return await this.generateExcelFile(
      "Customer Accounts",
      columns,
      formattedData,
      filename
    );
  }
}
