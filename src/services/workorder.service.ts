/**
 * Workorder Service
 *
 * Handles business logic for workorder-related operations including:
 * - Fetching workorders with advanced filtering and pagination
 * - Workorder history retrieval
 * - Workorder details management
 * - Excel export functionality with custom column mapping
 * - VMRS codes integration
 * - Priority date range handling
 *
 * Features:
 * - Complex filtering across multiple related tables
 * - In-memory sorting for computed fields
 * - Excel export with dynamic column configuration
 * - Support for account hierarchy filtering
 * - Equipment and service request integration
 *
 * @author Rajeswari
 * @version 1.0.0
 */

import prisma from "../config/database.config";
import { getPagination } from "../utils/pagination";
import {
  GetWorkordersParams,
  GetWorkordersDetailsParams,
} from "../types/dtos/workorder.dto";
import { buildOrderByFromSort } from "../utils/sort";
import { WORKORDER_SORT_FIELDS } from "../types/sorts/sortTypes";

import { ExcelExporter, formatDate } from "../utils/excelUtils";
import { Prisma } from "@prisma/client";

// Constants for date/time operations
const START_OF_DAY_HOURS = 0;
const START_OF_DAY_MINUTES = 0;
const START_OF_DAY_SECONDS = 0;
const START_OF_DAY_MILLISECONDS = 0;

const END_OF_DAY_HOURS = 23;
const END_OF_DAY_MINUTES = 59;
const END_OF_DAY_SECONDS = 59;
const END_OF_DAY_MILLISECONDS = 999;

// Constants for Excel column widths
const EXCEL_COLUMN_WIDTHS = {
  SNO: 10,
  DATE_FIELDS: 25,
  LONG_FIELDS: 30,
  DEFAULT: 20
} as const;

// Constants for array operations
const ARRAY_INDEX_FIRST = 0;
const ARRAY_INDEX_SECOND = 1;

/**
 * Helper function to build date range filters for start and end dates
 */
function buildDateRangeFilters(startDateStr: string, endDateStr: string): Prisma.workorderWhereInput[] {
  // Normalize date format - convert underscores to hyphens
  const normalizedStart = startDateStr.replaceAll('_', '-');
  const normalizedEnd = endDateStr.replaceAll('_', '-');
  
  const startDate = new Date(normalizedStart);
  const endDate = new Date(normalizedEnd);
  
  // Only add filters if dates are valid
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [];
  }
  
  const startOfDay = new Date(startDate);
  startOfDay.setUTCHours(START_OF_DAY_HOURS, START_OF_DAY_MINUTES, START_OF_DAY_SECONDS, START_OF_DAY_MILLISECONDS);
  
  const endOfDay = new Date(endDate);
  endOfDay.setUTCHours(END_OF_DAY_HOURS, END_OF_DAY_MINUTES, END_OF_DAY_SECONDS, END_OF_DAY_MILLISECONDS);
  
  return [
    { workorder_start_date: { gte: startOfDay } },
    { workorder_end_date: { lte: endOfDay } }
  ];
}

/**
 * Helper function to build date range filters for priority dates
 */
function buildPriorityDateFilters(priority_start?: string, priority_end?: string, priority_range?: string) {
  const filters: Prisma.workorderWhereInput[] = [];
  
  if (priority_start && priority_end) {
    const dateRangeFilters = buildDateRangeFilters(priority_start, priority_end);
    if (dateRangeFilters.length > ARRAY_INDEX_FIRST) {
      filters.push(...dateRangeFilters);
    }
  }
  
  if (priority_range) {
    const parts = priority_range.split("–").map((p) => p.trim());
    if (parts.length === ARRAY_INDEX_SECOND) {
      const dateRangeFilters = buildDateRangeFilters(parts[ARRAY_INDEX_FIRST], parts[ARRAY_INDEX_SECOND - 1]);
      if (dateRangeFilters.length > ARRAY_INDEX_FIRST) {
        filters.push(...dateRangeFilters);
      }
    }
  }
  
  return filters;
}

/**
 * Helper function to build single date filters
 * 
 * @param field - The database field name to filter on
 * @param dateValue - Date string in format YYYY-MM-DD or YYYY_MM_DD (e.g., "2025-10-09" or "2025_10_09")
 * @returns Array of Prisma where conditions for the date range (start to end of day)
 */
function buildSingleDateFilter(field: string, dateValue: string): Prisma.workorderWhereInput[] {
  // Normalize date format - convert underscores to hyphens
  const normalizedDate = dateValue.replaceAll('_', '-');
  
  // Parse the date and validate it
  const date = new Date(normalizedDate);
  
  // Check if the date is valid - return empty array if invalid
  if (Number.isNaN(date.getTime())) {
    // Invalid date format - skip filter silently
    return [];
  }
  
  // Create start and end of day in UTC
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(START_OF_DAY_HOURS, START_OF_DAY_MINUTES, START_OF_DAY_SECONDS, START_OF_DAY_MILLISECONDS);
  
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(END_OF_DAY_HOURS, END_OF_DAY_MINUTES, END_OF_DAY_SECONDS, END_OF_DAY_MILLISECONDS);
  
  return [{
    [field]: {
      gte: startOfDay,
      lte: endOfDay
    }
  } as Prisma.workorderWhereInput];
}

/**
 * Helper function to build created_at date filter
 */
function buildCreatedAtFilter(created_at?: string): Prisma.workorderWhereInput[] {
  if (!created_at) return [];
  return buildSingleDateFilter("created_at", created_at);
}

/**
 * Helper function to build workorder_end_date filter
 */
function buildWorkorderEndDateFilter(workorder_end_date?: string): Prisma.workorderWhereInput[] {
  if (!workorder_end_date) return [];
  return buildSingleDateFilter("workorder_end_date", workorder_end_date);
}

/**
 * Helper function to build assigned_date filter
 */
function buildAssignedDateFilter(assigned_date?: string): Prisma.workorderWhereInput[] {
  if (!assigned_date) return [];
  return buildSingleDateFilter("workorder_assigned_date", assigned_date);
}

/**
 * Helper function to build workorder_eta filter
 */
function buildWorkorderEtaFilter(workorder_eta?: string): Prisma.workorderWhereInput[] {
  if (!workorder_eta) return [];
  return buildSingleDateFilter("workorder_eta", workorder_eta);
}

/**
 * Helper function to build workorder_start_date filter
 */
function buildWorkorderStartDateFilter(workorder_start_date?: string): Prisma.workorderWhereInput[] {
  if (!workorder_start_date) return [];
  return buildSingleDateFilter("workorder_start_date", workorder_start_date);
}


/**
 * Helper function to build account filters
 */
function buildAccountFilters(account_number?: string, account_name?: string, account?: string) {
  const filters: Prisma.workorderWhereInput[] = [];
  
  if (account_number) {
    filters.push({
      service_request: {
        account: { account_number: { contains: account_number, mode: "insensitive" } }
      }
    });
  }
  
  if (account_name) {
    filters.push({
      service_request: {
        account: { account_name: { contains: account_name, mode: "insensitive" } }
      }
    });
  }
  
  if (account) {
    filters.push({
      OR: [
        { service_request: { account: { account_number: { contains: account, mode: "insensitive" } } } },
        { service_request: { account: { account_name: { contains: account, mode: "insensitive" } } } }
      ]
    });
  }
  
  return filters;
}

/**
 * Helper function to build invoice filters
 */
function buildInvoiceFilters(invoice_number?: string) {
  const filters: Prisma.workorderWhereInput[] = [];
  
  if (invoice_number) {
    filters.push({
      Invoice: {
        some: {
          invoiceNumber: { contains: invoice_number, mode: "insensitive" }
        }
      }
    });
  }
  
  return filters;
}

/**
 * Helper function to build customer PO filters
 */
function buildCustomerPOFilters(customer_po?: string) {
  const filters: Prisma.workorderWhereInput[] = [];
  
  if (customer_po) {
    filters.push({
      service_request: {
        account: {
          customer: {
            customer_po: { contains: customer_po, mode: "insensitive" }
          }
        }
      }
    });
  }
  
  return filters;
}

/**
 * Helper function to build invoice date filters
 */
function buildInvoiceDateFilter(invoice_date?: string): Prisma.workorderWhereInput[] {
  if (!invoice_date) return [];
  
  // Normalize date format - convert underscores to hyphens
  const normalizedDate = invoice_date.replaceAll('_', '-');
  
  // Parse the date and validate it
  const date = new Date(normalizedDate);
  
  // Check if the date is valid - return empty array if invalid
  if (Number.isNaN(date.getTime())) {
    // Invalid date format - skip filter silently
    return [];
  }
  
  // Create start and end of day in UTC
  const startOfDay = new Date(date);
  startOfDay.setUTCHours(START_OF_DAY_HOURS, START_OF_DAY_MINUTES, START_OF_DAY_SECONDS, START_OF_DAY_MILLISECONDS);
  
  const endOfDay = new Date(date);
  endOfDay.setUTCHours(END_OF_DAY_HOURS, END_OF_DAY_MINUTES, END_OF_DAY_SECONDS, END_OF_DAY_MILLISECONDS);
  
  return [{
    Invoice: {
      some: {
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      }
    }
  } as Prisma.workorderWhereInput];
}


/**
 * Helper function to build invoice total amount filters
 */
function buildInvoiceTotalAmountFilter(invoice_total_amount?: string): Prisma.workorderWhereInput[] {
  if (!invoice_total_amount) return [];
  
  // Try to parse as number
  const amount = Number.parseFloat(invoice_total_amount);
  
  // Check if the amount is valid - return empty array if invalid
  if (Number.isNaN(amount)) {
    // Invalid amount format - skip filter silently
    return [];
  }
  
  return [{
    Invoice: {
      some: {
        totalAmount: amount
      }
    }
  } as Prisma.workorderWhereInput];
}



/**
 * Helper function to build equipment filters
 */
function buildEquipmentFilters(unit_number?: string, customer_unit_number?: string) {
  const filters: Prisma.workorderWhereInput[] = [];
  
  if (unit_number) {
    filters.push({
      service_request: {
        equipment_ref: {
          is: { unit_number: { contains: unit_number, mode: "insensitive" } }
        }
      }
    });
  }
  
  if (customer_unit_number) {
    filters.push({
      service_request: {
        equipment_ref: {
          is: { customer_unit_number: { contains: customer_unit_number, mode: "insensitive" } }
        }
      }
    });
  }
  
  return filters;
}

type AccountIdsType = "all" | number[] | undefined;
type ExcelValueType = string | number | null;

/**
 * Helper function to handle account IDs for download
 */
async function handleAccountIdsForDownload(account_ids: AccountIdsType, downloadAll?: boolean) {
  let accountIdsArray: number[] = [];

  if (account_ids === "all") {
    if (downloadAll) {
      const allAccounts = await prisma.service_request.findMany({
        select: { account_id: true },
        distinct: ["account_id"],
      });
      accountIdsArray = allAccounts
        .map((a) => a.account_id)
        .filter((id): id is number => id !== null);
    } else {
      throw new Error(
        "Please pass specific accountIds for download when 'all' is selected"
     );
    }
  } else if (Array.isArray(account_ids)) {
    accountIdsArray = account_ids.filter((id): id is number => !Number.isNaN(id));
  }

  return accountIdsArray;
}

/**
 * Helper function to build workorder ID filter for download
 */
function buildWorkorderIdFilter(workorder_id: string | number | (string | number)[] | undefined, downloadAll?: boolean) {
  if (!workorder_id) return undefined;

  if (Array.isArray(workorder_id)) {
    return downloadAll
      ? { workorder_id: { in: workorder_id.map((id) => id) } }
      : { workorder_id: { notIn: workorder_id.map((id) => id) } };
  }

  return downloadAll
    ? { workorder_id: Number(workorder_id) }
    : { workorder_id: { not: Number(workorder_id) } };
}

/**
 * Helper function to build download filters
 */
function buildDownloadFilters(query: GetWorkordersParams, accountIdsArray: number[]) {
  return {
    AND: [
      accountIdsArray.length ? { service_request: { account_id: { in: accountIdsArray } } } : undefined,
      buildWorkorderIdFilter(query.workorder_id, query.downloadAll),
      query.equipment_id ? { service_request: { equipment_id: Number(query.equipment_id) } } : undefined,
      query.unit_number ? {
        service_request: {
          equipment_ref: {
            is: { unit_number: { contains: query.unit_number, mode: "insensitive" } }
          }
        }
      } : undefined,
      ...(query.customer_unit_number ? [{
        service_request: {
          equipment_ref: {
            is: { customer_unit_number: { contains: query.customer_unit_number, mode: "insensitive" } }
          }
        }
      }] : []),
      query.technician_name ? {
        technician_name: { contains: query.technician_name, mode: "insensitive" }
      } : undefined,
      query.workorder_ref_id ? {
        workorder_ref_id: { contains: query.workorder_ref_id, mode: "insensitive" }
      } : undefined,
      query.workorder_status ? { workorder_status: query.workorder_status } : undefined,
      ...buildCreatedAtFilter(query.created_at),
      ...buildWorkorderEndDateFilter(query.workorder_end_date),
      ...buildAccountFilters(query.account_number, query.account_name, query.account),
      ...buildInvoiceFilters(query.invoice_number),
      ...buildCustomerPOFilters(query.customer_po),
    ].filter(Boolean) as Prisma.workorderWhereInput[],
  };
}

/**
 * Helper function to calculate column width
 */
function calculateColumnWidth(field: string, maxWidth?: number): number {
  if (maxWidth) return maxWidth;
  
  if (field === "sno") return EXCEL_COLUMN_WIDTHS.SNO;
  
  const dateFields = ["assigned_date", "workorder_eta", "opened_date"];
  if (dateFields.includes(field)) return EXCEL_COLUMN_WIDTHS.DATE_FIELDS;
  
  const longFields = ["invoice_number", "customer_po", "priority_range"];
  if (longFields.includes(field)) return EXCEL_COLUMN_WIDTHS.LONG_FIELDS;
  
  return EXCEL_COLUMN_WIDTHS.DEFAULT;
}

/**
 * Helper function to format column values
 */
function formatColumnValue(val: unknown, field: string): string {
  const dateFields = ["assigned_date", "workorder_eta", "opened_date"];
  
  if (dateFields.includes(field)) {
    return formatDate(val as Date);
  }
  
  if (field === "invoice_number" || field === "customer_po") {
    return (val as string | null) ?? "";
  }
  
  return (val as string | null) ?? "";
}

/**
 * Helper function to format row values for Excel export
 */
function formatRowValue(wo: Record<string, unknown>, field: string, index: number): ExcelValueType {
  switch (field) {
    case "sno":
      return index + ARRAY_INDEX_SECOND;
    case "priority_range":
      return (wo.priority_range as string) || "";
    case "assigned_date":
    case "opened_date":
      return wo.workorder_assigned_date ? formatDate(wo.workorder_assigned_date as Date) : null;
    case "status":
      return (wo.workorder_status as string) ?? "";
    case "invoice_number":
      return (wo.invoice_number as string) ?? "";
    case "customer_po":
      return (wo.customer_po as string) ?? "";
    case "customer_unit_number":
      return (wo.customer_unit_number as string) ?? "";
    case "vmrs_code":
      return (wo.vmrs_code as string) ?? "";
    case "account":
      return (wo.account as string) ?? "";
    default: {
      const value = wo[field];
      return formatGenericValue(value);
    }
  }
}

/**
 * Helper function to format generic values
 */
function formatGenericValue(value: unknown): ExcelValueType {
  if (value instanceof Date) {
    return formatDate(value);
  }
  
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === "number" || typeof value === "string") {
    return value;
  }
  
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  
  return "";
}

/**
 * Builds common workorder filters that are shared between main and history services
 */
function buildCommonWorkorderFilters(params: GetWorkordersParams): Prisma.workorderWhereInput[] {
  const {
    equipment_id,
    workorder_id,
    technician_name,
    workorder_status,
    priority_start,
    priority_end,
    priority_range,
    assigned_date,
    workorder_ref_id,
    workorder_eta,
    unit_number,
    customer_unit_number,
    account_number,
    account_name,
    account,
    invoice_number,
    customer_po,
    created_at,
    workorder_end_date,
    workorder_start_date,
    invoice_date,
    invoice_total_amount,
  } = params;

  return [
    ...(equipment_id ? [{ service_request: { equipment_id: Number(equipment_id) } }] : []),
    ...(workorder_id ? [{ workorder_id: Number(workorder_id) }] : []),
    ...buildEquipmentFilters(unit_number, customer_unit_number),
    ...(technician_name ? [{ technician_name: { contains: technician_name, mode: "insensitive" } }] : []),
    ...(workorder_ref_id ? [{ workorder_ref_id: { contains: workorder_ref_id, mode: "insensitive" } }] : []),
    ...(workorder_status ? [{ workorder_status }] : []),
    ...buildPriorityDateFilters(priority_start, priority_end, priority_range),
    ...buildAssignedDateFilter(assigned_date),
    ...buildWorkorderEtaFilter(workorder_eta),
    ...buildCreatedAtFilter(created_at),
    ...buildWorkorderEndDateFilter(workorder_end_date),
    ...(typeof workorder_start_date === 'string' ? buildWorkorderStartDateFilter(workorder_start_date) : []),
    ...(typeof invoice_date === 'string' ? buildInvoiceDateFilter(invoice_date) : []),
    ...(typeof invoice_total_amount === 'string' ? buildInvoiceTotalAmountFilter(invoice_total_amount) : []),
    ...buildAccountFilters(account_number, account_name, account),
    ...buildInvoiceFilters(invoice_number),
    ...buildCustomerPOFilters(customer_po),
  ].filter(Boolean) as Prisma.workorderWhereInput[];
}

/**
 * Builds workorder filters for the main workorder service
 */
function buildWorkorderFilters(params: GetWorkordersParams): Prisma.workorderWhereInput {
  const { account_ids = [], vmrs_code } = params;

  return {
    AND: [
      ...(account_ids.length > ARRAY_INDEX_FIRST ? [{ service_request: { account_id: { in: account_ids } } }] : []),
      ...buildCommonWorkorderFilters(params),
      ...(vmrs_code ? [{ vmrsCodes: { some: { vmrs_Lookup: { vmrs_code: { contains: vmrs_code, mode: "insensitive" } } } } }] : []),
    ].filter(Boolean) as Prisma.workorderWhereInput[],
  };
}

/**
 * Handles sorting configuration and extracts priority range sort
 */
function handleWorkorderSorting(sort: string | undefined) {
  const rawOrderBy = buildOrderByFromSort(sort, WORKORDER_SORT_FIELDS, "workorder_id");
  let priorityRangeSort: { direction: "asc" | "desc" } | null = null;
  
  const orderBy = rawOrderBy.filter(
    (o: Prisma.workorderOrderByWithRelationInput & { _inMemoryPriorityRangeSort?: "asc" | "desc" }) => {
      if (o._inMemoryPriorityRangeSort) {
        priorityRangeSort = { direction: o._inMemoryPriorityRangeSort };
        return false;
      }
      return true;
    }
 );

  return { orderBy, priorityRangeSort };
}

/**
 * Interface for workorder with relations
 */
interface WorkorderWithRelations {
  workorder_id: number;
  workorder_start_date: Date | null;
  workorder_end_date: Date | null;
  workorder_assigned_date: Date | null;
  service_request?: {
    account_id: number | null,
    equipment_id: number | null,
    equipment_ref?: {
      unit_number: string | null,
      customer_unit_number: string | null
    } | null,
    account?: {
      account_number: string | null,
      account_name: string | null,
      customer?: {
        customer_po: string | null
      } | null
    } | null
  } | null;
  vmrsCodes?: {
    vmrs_Lookup: {
      vmrs_code: string
    }
  }[];
  Invoice?: {
    invoiceNumber: string
  }[];
}

/**
 * Transforms workorder data with computed fields
 */
function transformWorkorderData(workorders: WorkorderWithRelations[]) {
  return workorders.map((wo) => {
    const vmrsCodes = wo.vmrsCodes?.map((v) => v.vmrs_Lookup.vmrs_code) ?? [];
    const invoiceNumbers = wo.Invoice?.map((inv) => inv.invoiceNumber) ?? [];

    return {
      ...wo,
      account_id: wo.service_request?.account_id ?? null,
      equipment_id: wo.service_request?.equipment_id ?? null,
      unit_number: wo.service_request?.equipment_ref?.unit_number ?? null,
      customer_unit_number: wo.service_request?.equipment_ref?.customer_unit_number ?? null,
      account_number: wo.service_request?.account?.account_number ?? null,
      account_name: wo.service_request?.account?.account_name ?? null,
      customer_po: wo.service_request?.account?.customer?.customer_po ?? null,
      invoice_number: invoiceNumbers.length > ARRAY_INDEX_FIRST ? invoiceNumbers[ARRAY_INDEX_FIRST] : null,
      invoiceNumbers,
      account: wo.service_request?.account
        ? `${wo.service_request.account.account_name} (${wo.service_request.account.account_number})`
        : null,
      priority_range: formatDateRange(
        wo.workorder_start_date ?? new Date(),
        wo.workorder_end_date ?? new Date()
     ),
      vmrsCodes,
    };
  });
}

/**
 * Interface for workorder with priority range
 */
interface WorkorderWithPriorityRange {
  priority_range?: string | null
}

/**
 * Applies in-memory sorting for priority range
 */
function applyPriorityRangeSort(data: WorkorderWithPriorityRange[], priorityRangeSort: { direction: "asc" | "desc" } | null) {
  if (!priorityRangeSort) return;

  const { direction } = priorityRangeSort;
  data.sort((a, b) => {
    const aVal = a.priority_range ?? "";
    const bVal = b.priority_range ?? "";
    if (aVal < bVal) return direction === "asc" ? -1 : 1;
    if (aVal > bVal) return direction === "asc" ? 1 : -1;
    return 0;
  });
}

/**
 * Retrieves workorders with comprehensive filtering, pagination, and VMRS codes support
 * 
 * This is the main workorder service that includes all filtering capabilities
 * including VMRS codes integration. Supports complex filtering across multiple
 * related tables and in-memory sorting for computed fields.
 * 
 * @param params - Filtering and pagination parameters
 * @param params.account_ids - Array of account IDs to filter by
 * @param params.workorder_id - Specific workorder ID to filter by
 * @param params.equipment_id - Equipment ID to filter by
 * @param params.technician_name - Technician name filter (case-insensitive)
 * @param params.workorder_status - Workorder status filter
 * @param params.priority_start - Priority start date filter
 * @param params.priority_end - Priority end date filter
 * @param params.priority_range - Priority date range filter (formatted string)
 * @param params.assigned_date - Assigned date filter
 * @param params.workorder_ref_id - Workorder reference ID filter
 * @param params.workorder_eta - Workorder ETA filter
 * @param params.unit_number - Unit number filter
 * @param params.customer_unit_number - Customer unit number filter
 * @param params.account_number - Account number filter
 * @param params.account_name - Account name filter
 * @param params.account - General account filter (searches both number and name)
 * @param params.vmrs_code - VMRS code filter (case-insensitive)
 * @param params.page - Page number for pagination
 * @param params.perPage - Number of items per page
 * @param params.sort - Sorting configuration
 * 
 * @returns Promise containing paginated workorder data with VMRS codes and computed fields
 * 
 * @example
 * ```typescript
 * const result = await getWorkordersService({
 *   account_ids: [1, 2, 3],
 *   workorder_status: 'OPEN',
 *   vmrs_code: '001',
 *   page: 1,
 *   perPage: 10
 * });
 * ```
 */
export const getWorkordersService = async (params: GetWorkordersParams) => {
  const { page, perPage, ...rest } = params;

  // Pagination
  const { skip, take, page: currentPage, perPage: limit } = getPagination({
    page,
    perPage,
  });

  // Build filters
  const filters = buildWorkorderFilters(params);

  // Handle sorting
  const { orderBy, priorityRangeSort } = handleWorkorderSorting(rest.sort);

  // Count and query
  const [total, workorders] = await Promise.all([
    prisma.workorder.count({ where: filters }),
    prisma.workorder.findMany({
      where: filters,
      include: {
        service_request: {
          select: {
            account_id: true,
            equipment_id: true,
            equipment_ref: { select: { unit_number: true, customer_unit_number: true } },
            account: { 
              select: { 
                account_number: true, 
                account_name: true,
                customer: { select: { customer_po: true } }
              } 
            },
          },
        },
        vmrsCodes: {
          include: { vmrs_Lookup: true },
        },
        Invoice: {
          select: { invoiceNumber: true },
        },
      },
      skip,
      take,
      orderBy,
    })
  ]);

  // Transform data
  const data = transformWorkorderData(workorders);

  // Apply in-memory sorting
  applyPriorityRangeSort(data, priorityRangeSort);

  return {
    data,
    total,
    page: currentPage,
    perPage: limit,
    message: "Fetched successfully workorders history",
  };
};

/**
 * Builds workorder history filters (without VMRS codes)
 */
function buildWorkorderHistoryFilters(params: GetWorkordersParams): Prisma.workorderWhereInput {
  return {
    AND: buildCommonWorkorderFilters(params),
  };
}

/**
 * Interface for workorder history with relations (without VMRS codes)
 */
interface WorkorderHistoryWithRelations {
  workorder_start_date: Date | null;
  workorder_end_date: Date | null;
  service_request?: {
    account_id: number | null,
    equipment_id: number | null,
    equipment_ref?: {
      unit_number: string | null,
      customer_unit_number: string | null
    } | null,
    account?: {
      account_number: string | null,
      account_name: string | null,
      customer?: {
        customer_po: string | null
      } | null
    } | null
  } | null;
  Invoice?: {
    invoiceNumber: string,
    date: Date | null,
    totalAmount: number | null
  }[];
}

/**
 * Helper function to extract invoice data from workorder
 */
function extractInvoiceData(invoices: { invoiceNumber: string, date: Date | null, totalAmount: number | null }[] | undefined) {
  const invoiceNumbers = invoices?.map((inv) => inv.invoiceNumber) ?? [];
  const invoiceDates = invoices?.map((inv) => inv.date) ?? [];
  const invoiceTotalAmounts = invoices?.map((inv) => inv.totalAmount) ?? [];
  
  return {
    invoiceNumbers,
    invoiceDates,
    invoiceTotalAmounts,
    invoice_number: invoiceNumbers.length > ARRAY_INDEX_FIRST ? invoiceNumbers[ARRAY_INDEX_FIRST] : null,
    invoice_date: invoiceDates.length > ARRAY_INDEX_FIRST ? invoiceDates[ARRAY_INDEX_FIRST] : null,
    invoice_total_amount: invoiceTotalAmounts.length > ARRAY_INDEX_FIRST ? invoiceTotalAmounts[ARRAY_INDEX_FIRST] : null,
  };
}

/**
 * Helper function to extract service request data from workorder
 */
function extractServiceRequestData(serviceRequest: WorkorderHistoryWithRelations['service_request']) {
  return {
    account_id: serviceRequest?.account_id ?? null,
    equipment_id: serviceRequest?.equipment_id ?? null,
    unit_number: serviceRequest?.equipment_ref?.unit_number ?? null,
    customer_unit_number: serviceRequest?.equipment_ref?.customer_unit_number ?? null,
    account_number: serviceRequest?.account?.account_number ?? null,
    account_name: serviceRequest?.account?.account_name ?? null,
    customer_po: serviceRequest?.account?.customer?.customer_po ?? null,
    account: serviceRequest?.account
      ? `${serviceRequest.account.account_name} (${serviceRequest.account.account_number})`
      : null,
  };
}

/**
 * Transforms workorder history data (without VMRS codes)
 */
function transformWorkorderHistoryData(workorders: WorkorderHistoryWithRelations[]) {
  return workorders.map((wo) => {
    const invoiceData = extractInvoiceData(wo.Invoice);
    const serviceRequestData = extractServiceRequestData(wo.service_request);
    
    return {
      ...wo,
      ...serviceRequestData,
      ...invoiceData,
      priority_range: formatDateRange(
        wo.workorder_start_date ?? new Date(),
        wo.workorder_end_date ?? new Date()
     ),
    };
  });
}

/**
 * Retrieves workorder history with filtering and pagination
 * 
 * Specialized service for fetching workorder history data. Similar to the main
 * workorder service but optimized for historical data retrieval without VMRS codes.
 * 
 * @param params - Filtering and pagination parameters
 * @param params.equipment_id - Equipment ID to filter by
 * @param params.workorder_id - Specific workorder ID to filter by
 * @param params.technician_name - Technician name filter (case-insensitive)
 * @param params.workorder_status - Workorder status filter
 * @param params.priority_start - Priority start date filter
 * @param params.priority_end - Priority end date filter
 * @param params.priority_range - Priority date range filter (formatted string)
 * @param params.assigned_date - Assigned date filter
 * @param params.workorder_ref_id - Workorder reference ID filter
 * @param params.workorder_eta - Workorder ETA filter
 * @param params.unit_number - Unit number filter
 * @param params.customer_unit_number - Customer unit number filter
 * @param params.account_number - Account number filter
 * @param params.account_name - Account name filter
 * @param params.account - General account filter (searches both number and name)
 * @param params.workorder_start_date - Workorder start date filter
 * @param params.invoice_date - Invoice date filter
 * @param params.invoice_total_amount - Invoice total amount filter
 * @param params.page - Page number for pagination
 * @param params.perPage - Number of items per page
 * @param params.sort - Sorting configuration
 * 
 * @returns Promise containing paginated workorder history data
 * 
 * @example
 * ```typescript
 * const result = await getWorkordersHistoryService({
 *   equipment_id: '123',
 *   workorder_status: 'COMPLETED',
 *   page: 1,
 *   perPage: 20
 * });
 * ```
 */
export const getWorkordersHistoryService = async (params: GetWorkordersParams) => {
  const { page, perPage, ...rest } = params;

  // Pagination
  const { skip, take, page: currentPage, perPage: limit } = getPagination({
    page,
    perPage,
  });

  // Build filters
  const filters = buildWorkorderHistoryFilters(params);

  // Handle sorting
  const { orderBy, priorityRangeSort } = handleWorkorderSorting(rest.sort);

  // Count and query
  const [total, workorders] = await Promise.all([
    prisma.workorder.count({ where: filters }),
    prisma.workorder.findMany({
      where: filters,
      include: {
        service_request: {
          select: {
            account_id: true,
            equipment_id: true,
            equipment_ref: {
              select: {
                unit_number: true,
                customer_unit_number: true,
              },
            },
            account: {
              select: {
                account_number: true,
                account_name: true,
                customer: { select: { customer_po: true } },
              },
            },
          },
        },
        Invoice: {
          select: { 
            invoiceNumber: true,
            date: true,
            totalAmount: true
          },
        },
      },
      skip,
      take,
      orderBy,
    })
  ]);

  // Transform data
  const data = transformWorkorderHistoryData(workorders);

  // Apply in-memory sorting
  applyPriorityRangeSort(data, priorityRangeSort);

  return { 
    data, 
    total, 
    page: currentPage, 
    perPage: limit, 
    message: "Fetched workorders successfully" 
  };
};

/**
 * Retrieves detailed workorder information including attachments and VMRS codes
 * 
 * Fetches comprehensive workorder details including related service request data,
 * equipment information, attachments, creator details, and associated VMRS codes.
 * 
 * @param params - Parameters for workorder details retrieval
 * @param params.account_id - Account ID (required)
 * @param params.equipment_id - Equipment ID (required)
 * @param params.service_request_id - Service request ID (required)
 * 
 * @returns Promise containing detailed workorder data with all related information
 * 
 * @example
 * ```typescript
 * const details = await getWorkorderDetailsService({
 *   account_id: 123,
 *   equipment_id: 456,
 *   service_request_id: 789
 * });
 * ```
 */
export const getWorkorderDetailsService = async ({
  account_id,
  equipment_id,
  service_request_id,
}: GetWorkordersDetailsParams) => {
  const workorders = await prisma.workorder.findMany({
    where: {
      service_request: {
        account_id,
        equipment_id,
        service_request_id,
      },
    },
    include: {
      service_request: {
        select: {
          service_request_id: true,
          account_id: true,
          equipment_id: true,
          issue_description: true,
          created_at: true,
          equipment_ref: {
            select: {
              unit_number: true,
              customer_unit_number: true,
              description: true,
              vin: true,
              oem_make_model_ref: {
                select: {
                  make: true,
                  model: true,
                },
              },
              equipment_type_lookup_ref: {
                select: {
                  equipment_type_lookup_id: true,
                  equipment_name: true,
                  equipment_type: true,
                  equipment_description: true,
                },
              },
            },
          },
          account: {
            select: {
              account_name: true,
              account_number: true,
              customer: {
                select: {
                  customer_po: true,
                },
              },
            },
          },
        },
      },

      // include attachments
      workorder_has_attachment: {
        include: {
          attachment_ref: true,
        },
      },

      // include creator name
      created_by_user: {
        select: {
          first_name: true,
          last_name: true,
        },
      },

      // include VMRS codes via join table
      vmrsCodes: {
        include: {
          vmrs_Lookup: true,
        },
      },

      // include invoice data
      Invoice: {
        select: {
          invoiceNumber: true,
          subTotal: true,
          taxes: true,
          totalAmount: true,
          other_charges: true,
          shop_supplies_charges: true,
          workorder_id: true,
        },
      },
    },
  });

  // transform response
  const response = workorders.map((w) => ({
    ...w,
    created_name: w.created_by_user
      ? `${w.created_by_user.first_name ?? ""} ${
          w.created_by_user.last_name ?? ""
        }`.trim()
      : null,
    // Add combined account information
    account_info: w.service_request?.account
      ? `${w.service_request.account.account_name} (${w.service_request.account.account_number})`
      : null,
    // Add equipment description and vin
    equipment_description: w.service_request?.equipment_ref?.description ?? null,
    equipment_vin: w.service_request?.equipment_ref?.vin ?? null,
    // Add customer PO
    customer_po: w.service_request?.account?.customer?.customer_po ?? null,
    // Add account details
    account_name: w.service_request?.account?.account_name ?? null,
    account_number: w.service_request?.account?.account_number ?? null,
  }));

  return { workorders: response };
};

/**
 * Helper function to build sort string from query sort parameter
 */
function buildSortString(sort: GetWorkordersParams['sort']): string | undefined {
  if (!sort) return undefined;
  
  if (typeof sort === "object") {
    const entries = Object.entries(sort);
    return entries
      .map(([field, order]) => {
        const orderStr = String(order);
        return `${field}:${orderStr}`;
      })
      .join(",");
  }
  
  return sort;
}

/**
 * Helper function to build order by clause for workorder queries
 */
function buildWorkorderOrderBy(query: GetWorkordersParams) {
  const sortString = buildSortString(query.sort);
  let orderBy = buildOrderByFromSort(
    sortString,
    WORKORDER_SORT_FIELDS,
    "workorder_id"
  );

  if (!orderBy || orderBy.length === ARRAY_INDEX_FIRST) {
    orderBy = [{ workorder_id: "asc" }];
  }

  return orderBy;
}

/**
 * Interface for workorder with download relations
 */
interface WorkorderWithDownloadRelations {
  workorder_id: number;
  workorder_start_date: Date | null;
  workorder_end_date: Date | null;
  workorder_assigned_date: Date | null;
  service_request?: {
    account_id: number | null,
    equipment_id: number | null,
    equipment_ref?: {
      unit_number: string | null,
      customer_unit_number: string | null
    } | null,
    account?: {
      account_number: string | null,
      account_name: string | null,
      customer?: {
        customer_po: string | null
      } | null
    } | null
  } | null;
  vmrsCodes?: {
    vmrs_Lookup: {
      vmrs_code: string
    }
  }[];
  Invoice?: {
    invoiceNumber: string
  }[];
}

/**
 * Interface for transformed workorder row
 */
interface WorkorderRow {
  workorder_id: number;
  workorder_start_date: Date | null;
  workorder_end_date: Date | null;
  workorder_assigned_date: Date | null;
  service_request?: {
    account_id: number | null,
    equipment_id: number | null,
    equipment_ref?: {
      unit_number: string | null,
      customer_unit_number: string | null
    } | null,
    account?: {
      account_number: string | null,
      account_name: string | null,
      customer?: {
        customer_po: string | null
      } | null
    } | null
  } | null;
  Invoice?: {
    invoiceNumber: string
  }[];
  account_id: number | null;
  equipment_id: number | null;
  unit_number: string | null;
  customer_unit_number: string | null;
  account_number: string | null;
  account_name: string | null;
  account: string | null;
  customer_po: string | null;
  invoice_number: string | null;
  invoiceNumbers: string[];
  vmrs_code: string | null;
  vmrsCodes: string[];
  opened_date: Date | null;
  priority_range: string;
}

/**
 * Helper function to transform workorder data for download
 */
function transformWorkorderForDownload(wo: WorkorderWithDownloadRelations): WorkorderRow {
  const invoiceNumbers = wo.Invoice?.map((inv) => inv.invoiceNumber) ?? [];
  const vmrsCodes = wo.vmrsCodes?.map((v) => v.vmrs_Lookup.vmrs_code) ?? [];
  
  return {
    ...wo,
    account_id: wo.service_request?.account_id ?? null,
    equipment_id: wo.service_request?.equipment_id ?? null,
    unit_number: wo.service_request?.equipment_ref?.unit_number ?? null,
    customer_unit_number: wo.service_request?.equipment_ref?.customer_unit_number ?? null,
    account_number: wo.service_request?.account?.account_number ?? null,
    account_name: wo.service_request?.account?.account_name ?? null,
    account: wo.service_request?.account
      ? `${wo.service_request.account.account_name} (${wo.service_request.account.account_number})`
      : null,
    customer_po: wo.service_request?.account?.customer?.customer_po ?? null,
    invoice_number: invoiceNumbers.length > ARRAY_INDEX_FIRST ? invoiceNumbers[ARRAY_INDEX_FIRST] : null,
    invoiceNumbers,
    vmrs_code: vmrsCodes.length > ARRAY_INDEX_FIRST ? vmrsCodes.join(", ") : null,
    vmrsCodes: vmrsCodes,
    opened_date: wo.workorder_assigned_date ?? null,
    priority_range: `${formatDate(wo.workorder_start_date)} - ${formatDate(wo.workorder_end_date)}`,
  };
}

/**
 * Helper function to prepare Excel columns configuration
 */
function prepareExcelColumns(requestedColumns: { label: string, field: string, maxWidth?: number }[]) {
  return requestedColumns.map(({ label, field, maxWidth }) => {
    const width = calculateColumnWidth(field, maxWidth);
    return {
      header: label,
      key: field,
      width,
      formatter: (val: unknown) => formatColumnValue(val, field),
    };
  });
}

/**
 * Helper function to prepare Excel data rows
 */
function prepareExcelData(transformedData: WorkorderRow[], requestedColumns: { label: string, field: string, maxWidth?: number }[]) {
  return transformedData.map((wo, index) => {
    const row: Record<string, string | number | null> = {};
    for (const { field } of requestedColumns) {
      row[field] = formatRowValue(wo as unknown as Record<string, unknown>, field, index);
    }
    return row;
  });
}

/**
 * Helper function to generate Excel filename with timestamp
 */
function generateExcelFilename(): string {
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, "-").slice(0, -5);
  return `workorders_${timestamp}.xlsx`;
}

/**
 * Generates Excel export for workorders with custom column configuration
 * 
 * Creates an Excel file containing workorder data with dynamic column mapping.
 * Supports custom column definitions, filtering, and formatting. Handles large
 * datasets with pagination and provides flexible column width configuration.
 * 
 * @param payload - Export configuration and data
 * @param payload.query - Filtering parameters for workorder data
 * @param payload.columns - Column definitions for Excel export
 * @param payload.columns.label - Display label for the column
 * @param payload.columns.field - Field name to extract from workorder data
 * @param payload.columns.maxWidth - Optional maximum width for the column
 * 
 * @returns Promise containing Excel buffer and filename
 * 
 * @example
 * ```typescript
 * const { buffer, filename } = await downloadWorkordersService({
 *   query: { account_ids: [1, 2, 3], workorder_status: 'OPEN' },
 *   columns: [
 *     { label: 'Workorder ID', field: 'workorder_id', maxWidth: 15 },
 *     { label: 'Status', field: 'workorder_status', maxWidth: 20 }
 *   ]
 * });
 * ```
 */
export const downloadWorkordersService = async (payload: {
  query: GetWorkordersParams,
  columns: { label: string, field: string, maxWidth?: number }[]
}) => {
  const { query, columns: requestedColumns } = payload;

  // Handle account IDs and build filters
  const accountIdsArray = await handleAccountIdsForDownload(query.account_ids, query.downloadAll);
  const filters: Prisma.workorderWhereInput = buildDownloadFilters(query, accountIdsArray);

  // Build order by clause
  const orderBy = buildWorkorderOrderBy(query);

  // Fetch workorders
  const workorders = await prisma.workorder.findMany({
    where: filters,
    include: {
      service_request: {
        select: {
          account_id: true,
          equipment_id: true,
          equipment_ref: {
            select: {
              unit_number: true,
              customer_unit_number: true,
            },
          },
          account: {
            select: {
              account_number: true,
              account_name: true,
              customer: { select: { customer_po: true } },
            },
          },
        },
      },
      vmrsCodes: {
        include: { vmrs_Lookup: true },
      },
      Invoice: {
        select: { invoiceNumber: true },
      },
    },
    orderBy,
  });

  // Transform workorders
  const transformedData = workorders.map(transformWorkorderForDownload);

  // Prepare Excel configuration
  const excelColumns = prepareExcelColumns(requestedColumns);
  const formattedData = prepareExcelData(transformedData, requestedColumns);
  const filename = generateExcelFilename();

  // Export Excel
  const exporter = new ExcelExporter();
  exporter.generateWorkbook({
    sheetName: "Workorders",
    columns: excelColumns,
    data: formattedData,
    filename,
  });

  const buffer = await exporter.writeToBuffer();
  return { buffer, filename };
};

/**
 * Helper function for formatting priority date ranges
 * 
 * Formats a date range into a human-readable string with month abbreviations
 * and year. Used for displaying priority date ranges in workorder listings.
 * 
 * @param start - Start date of the priority range
 * @param end - End date of the priority range
 * @returns Formatted date range string (e.g., "Jan 15 – Jan 20, 2024")
 * 
 * @example
 * ```typescript
 * const range = formatDateRange(new Date('2024-01-15'), new Date('2024-01-20'));
 * // Returns: "Jan 15 – Jan 20, 2024"
 * ```
 */
function formatDateRange(start: Date, end: Date) {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  const year = start.getFullYear();
  const startStr = start.toLocaleDateString("en-US", options);
  const endStr = end.toLocaleDateString("en-US", options);
  return `${startStr} – ${endStr}, ${year}`;
}
