/**
 * ERS Service
 *
 * Handles business logic for Emergency Roadside Service (ERS) operations including:
 * - Fetching ERS records with filtering and pagination
 * - Managing ERS details with attachments and communication logs
 * - Excel export functionality for ERS data
 * - Complex filtering by account, equipment, location, and status
 *
 * Security considerations:
 * - Input validation and sanitization
 * - SQL injection prevention through Prisma ORM
 * - Data access control through account filtering
 * - Safe number conversion and type checking
 *
 * @author Rajeswari
 * @version 1.0.0
 */

import prisma from "../config/database.config";
import { getPagination } from "../utils/pagination";
import { GetERSParams, GetERSDetailsParams } from "../types/dtos/ers.dto";
import { buildOrderByFromSort } from "../utils/sort";
import { ERS_SORT_FIELDS } from "../types/sorts/sortTypes";

import { ExcelExporter, formatDate } from "../utils/excelUtils";
import { Prisma } from "@prisma/client";

type ExcelValue = string | number | null;

// Type definitions for ERS data transformation
interface ERSListItem {
  service_request?: {
    account_id: number | null,
    equipment_id: number | null,
    account?: {
      account_number: string | null,
      account_name: string | null,
      customer?: {
        customer_po: string | null
      } | null
    } | null,
    equipment_ref?: {
      unit_number: string | null,
      customer_unit_number: string | null
    } | null
  } | null;
  workorder?: {
    workorder_id: number,
    workorder_ref_id: string | null,
    vmrsCodes?: {
      vmrs_Lookup: {
        vmrs_code: string
      }
    }[]
  } | null;
  ers_parts_used: { part_name: string }[];
  [key: string]: unknown
}

interface ERSDetailsItem {
  service_request?: {
    equipment_ref?: {
      unit_number: string | null,
      description: string | null,
      customer_unit_number: string | null,
      vin: string | null
    } | null,
    account?: {
      account_name: string | null,
      account_number: string | null,
      customer?: {
        customer_po: string | null
      } | null
    } | null
  } | null;
  workorder?: {
    workorder_id: number,
    workorder_ref_id: string | null,
    workorder_start_date: Date | null,
    workorder_end_date: Date | null,
    created_at: Date | null,
    location: string | null,
    sservice_state: string | null,
    vmrs_data: unknown,
    workorder_status: string | null,
    vmrsCodes?: {
      workorder_id: number,
      vmrs_id: number,
      workorder_part_cost: number | null,
      workorder_labour_cost: number | null,
      workorder_totalCost: number | null,
      part_description: string | null,
      line: number | null,
      is_billable: boolean | null,
      created_at: Date | null,
      created_by: string | null,
      updated_at: Date | null,
      updated_by: string | null,
      vmrs_Lookup: {
        vmrs_id: number,
        vmrs_code: string,
        labor_cost: number | null,
        part_cost: number | null,
        part_quantity: number | null,
        vmrs_description: string | null,
        created_at: Date | null,
        created_by: string | null,
        updated_at: Date | null,
        updated_by: string | null
      }
    }[],
    Invoice?: {
      id: number,
      invoiceNumber: string | null,
      subTotal: number | null,
      taxes: number | null,
      totalAmount: number | null,
      other_charges: number | null,
      shop_supplies_charges: number | null
    }[]
  } | null;
  iot_device_vendor_ref?: { vendor_name: string | null } | null;
  created_by_user?: { first_name: string | null, last_name: string | null } | null;
  updated_by_user?: { first_name: string | null, last_name: string | null } | null;
  communication_log: {
    vendor_name: string | null,
    driver_name: string | null
  }[];
  ers_has_attachment?: {
    ers_has_attachment_id: number,
    date_uploaded: Date | null,
    expiration_date: Date | null,
    attachment_ref?: {
      attachment_id: number | null,
      name: string | null,
      mime_type: string | null,
      url: string | null,
      description: string | null,
      date_uploaded: Date | null,
      expiration_date: Date | null
    } | null
  }[] | null;
  ers_parts_used?: { part_name: string }[] | null;
  [key: string]: unknown
}

/**
 * Helper function to safely convert unknown values to numbers
 * @param value - The value to convert to number
 * @returns The converted number or undefined if conversion fails
 */
const safeNumber = (value: unknown): number | undefined => {
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

/**
 * Helper function to build date range filter
 * @param dateValue - The date value to filter by
 * @returns Date range filter object
 */
const buildDateRangeFilter = (dateValue: unknown) => {
  if (!dateValue) return undefined;
  
  // Handle string dates more robustly
  let date: Date;
  if (typeof dateValue === 'string') {
    date = new Date(dateValue);
  } else if (dateValue instanceof Date) {
    date = dateValue;
  } else if (typeof dateValue === 'number') {
    date = new Date(dateValue);
  } else {
    // For unexpected types, return undefined
    return undefined;
  }
  
  // Check if date is valid
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  
  return {
    gte: new Date(new Date(date).setUTCHours(0, 0, 0, 0)),
    lte: new Date(new Date(date).setUTCHours(23, 59, 59, 999)),
  };
};

/**
 * Helper function to build account filter
 * @param account - Account name or number for filtering
 * @returns Account filter object
 */
const buildAccountFilter = (account: string | undefined) => {
  if (!account) return undefined;
  return {
    OR: [
      { service_request: { account: { account_name: { contains: account, mode: "insensitive" } } } },
      { service_request: { account: { account_number: { contains: account, mode: "insensitive" } } } },
    ],
  };
};

/**
 * Helper function to build customer PO filter
 * @param customer_po - Customer PO for filtering
 * @returns Customer PO filter object
 */
const buildCustomerPOFilter = (customer_po: unknown): Prisma.ersWhereInput | undefined => {
  if (!customer_po || typeof customer_po !== 'string') return undefined;
  return {
    service_request: { 
      account: { 
        customer: { 
          customer_po: { 
            contains: customer_po, 
            mode: "insensitive"
          } 
        } 
      } 
    }
  };
};

/**
 * Helper function to build VMRS codes filter
 * @param vmrsCodes - VMRS codes for filtering
 * @returns VMRS codes filter object
 */
const buildVMRSCodesFilter = (vmrsCodes: unknown): Prisma.ersWhereInput | undefined => {
  if (!vmrsCodes || typeof vmrsCodes !== 'string') return undefined;
  return {
    workorder: {
      vmrsCodes: {
        some: {
          vmrs_Lookup: { 
            vmrs_code: { 
              contains: vmrsCodes, 
              mode: "insensitive"
            } 
          },
        },
      },
    },
  };
};

/**
 * Helper function to build workorder ref ID filter
 * @param workorderRefId - Workorder reference ID for filtering
 * @returns Workorder ref ID filter object
 */
const buildWorkorderRefIdFilter = (workorderRefId: unknown): Prisma.ersWhereInput | undefined => {
  if (!workorderRefId || typeof workorderRefId !== 'string') return undefined;
  return {
    workorder: { 
      workorder_ref_id: { 
        contains: workorderRefId, 
        mode: "insensitive" 
      } 
    }
  };
};

/**
 * Helper function to handle account IDs for download
 * @param query - Query parameters
 * @returns Array of account IDs
 */
const handleAccountIdsForDownload = async (query: GetERSParams): Promise<number[]> => {
  if (query.account_ids === "all") {
    if (query.downloadAll) {
      const allAccounts = await prisma.service_request.findMany({
        select: { account_id: true },
        distinct: ["account_id"],
      });
      return allAccounts
        .map((a) => a.account_id)
        .filter((id): id is number => id !== null);
    } else {
      throw new Error(
        "Please provide specific account_ids when 'all' is selected"
      );
    }
  } else if (Array.isArray(query.account_ids)) {
    return query.account_ids.map((id) => id).filter(Boolean);
  }
  return [];
};

/**
 * Helper function to build ERS ID filter
 * @param ersId - ERS ID value
 * @param downloadAll - Whether to download all or exclude
 * @returns ERS ID filter object
 */
const buildERSIdFilter = (ersId: unknown, downloadAll?: boolean) => {
  if (!ersId) return undefined;
  
  if (Array.isArray(ersId)) {
    return downloadAll
    ? { ers_id: { in: ersId.map(Number) } }
    : { ers_id: { notIn: ersId.map(Number) } };
  }
  
  const numericId = safeNumber(ersId);
  if (numericId === undefined) return undefined;
  
  return downloadAll
    ? { ers_id: numericId }
    : { ers_id: { not: numericId } };
};

/**
 * Helper function to build equipment-related filters
 * @param rest - Query parameters
 * @returns Array of equipment filter conditions
 */
const buildEquipmentFilters = (rest: Partial<GetERSParams>) => [
  rest.equipment_id ? { service_request: { equipment_id: rest.equipment_id } } : undefined,
  rest.unit_number
    ? { service_request: { equipment_ref: { unit_number: { contains: rest.unit_number, mode: "insensitive" } } } }
    : undefined,
  rest.customer_unit_number
    ? { service_request: { equipment_ref: { customer_unit_number: { contains: rest.customer_unit_number, mode: "insensitive" } } } }
    : undefined,
];

/**
 * Helper function to build account-related filters
 * @param rest - Query parameters
 * @returns Array of account filter conditions
 */
const buildAccountFilters = (rest: Partial<GetERSParams>) => [
  rest.account_number
    ? { service_request: { account: { account_number: { contains: rest.account_number, mode: "insensitive" } } } }
    : undefined,
  rest.account_name
    ? { service_request: { account: { account_name: { contains: rest.account_name, mode: "insensitive" } } } }
    : undefined,
  buildCustomerPOFilter(rest.customer_po),
];

/**
 * Helper function to build ERS-specific filters
 * @param rest - Query parameters
 * @returns Array of ERS filter conditions
 */
const buildERSFilters = (rest: Partial<GetERSParams>) => [
  rest.ers_id && safeNumber(rest.ers_id) ? { ers_id: safeNumber(rest.ers_id) } : undefined,
  rest.ers_ref_id ? { ers_ref_id: { contains: rest.ers_ref_id, mode: "insensitive" } } : undefined,
  rest.location ? { OR: [{ location: { contains: rest.location, mode: "insensitive" } }] } : undefined,
  rest.ers_service_level ? { ers_service_level: { contains: rest.ers_service_level, mode: "insensitive" } } : undefined,
  rest.ers_status ? { ers_status: { contains: rest.ers_status, mode: "insensitive" } } : undefined,
  rest.hide_completed ? { ers_status: { not: { equals: "completed" } } } : undefined,
  rest.completed ? { ers_status: { equals: "completed" } } : undefined,
];

/**
 * Helper function to build workorder-related filters
 * @param rest - Query parameters
 * @returns Array of workorder filter conditions
 */
const buildWorkorderFilters = (rest: Partial<GetERSParams>) => [
  rest.event_type
    ? { ers_parts_used: { some: { part_name: { contains: rest.event_type, mode: "insensitive" } } } }
    : undefined,
  rest.vmrs_code
    ? {
        workorder: {
          vmrsCodes: {
            some: {
              vmrs_Lookup: { vmrs_code: { contains: rest.vmrs_code, mode: "insensitive" } },
            },
          },
        },
      }
    : undefined,
  buildWorkorderRefIdFilter(rest.workorder_ref_id),
  buildVMRSCodesFilter(rest.vmrsCodes),
];

/**
 * Helper function to build basic filters for ERS queries
 * @param rest - Query parameters
 * @returns Array of basic filter conditions
 */
const buildBasicFilters = (rest: Partial<GetERSParams>) => [
  ...buildERSFilters(rest),
  ...buildEquipmentFilters(rest),
  ...buildAccountFilters(rest),
  ...buildWorkorderFilters(rest),
];

/**
 * Helper function to build download-specific ERS filters
 * @param query - Query parameters
 * @returns Array of download ERS filter conditions
 */
const buildDownloadERSFilters = (query: GetERSParams) => [
  buildERSIdFilter(query.ers_id, query.downloadAll),
  query.ers_ref_id
    ? {
        ers_ref_id: {
          contains: query.ers_ref_id,
          mode: "insensitive",
        },
      }
    : undefined,
  query.location
    ? {
        location: { contains: query.location, mode: "insensitive" },
      }
    : undefined,
  query.ers_status ? { ers_status: query.ers_status } : undefined,
  query.ers_service_level
    ? { ers_service_level: query.ers_service_level }
    : undefined,
  query.hide_completed ? { ers_status: { not: { equals: "completed" } } } : undefined,
  query.completed ? { ers_status: { equals: "completed" } } : undefined,
];

/**
 * Helper function to build download equipment filters
 * @param query - Query parameters
 * @returns Array of download equipment filter conditions
 */
const buildDownloadEquipmentFilters = (query: GetERSParams) => [
  query.equipment_id ? { equipment_id: query.equipment_id } : undefined,
  query.unit_number
    ? {
        service_request: {
          equipment_ref: {
            unit_number: {
              contains: query.unit_number,
              mode: "insensitive",
            },
          },
        },
      }
    : undefined,
  query.customer_unit_number
    ? { service_request: { equipment_ref: { customer_unit_number: { contains: query.customer_unit_number, mode: "insensitive" } } } }
    : undefined,
];

/**
 * Helper function to build download date filters
 * @param query - Query parameters
 * @returns Array of download date filter conditions
 */
const buildDownloadDateFilters = (query: GetERSParams) => [
  query.created_at ? { created_at: buildDateRangeFilter(query.created_at) } : undefined,
  query.ers_end_date ? { ers_end_date: buildDateRangeFilter(query.ers_end_date) } : undefined,
];

/**
 * Helper function to build download filters for ERS queries
 * @param query - Query parameters
 * @param accountIdsArray - Array of account IDs
 * @returns Array of filter conditions for download
 */
const buildDownloadFilters = (query: GetERSParams, accountIdsArray: number[]) => [
  accountIdsArray.length
    ? { service_request: { account_id: { in: accountIdsArray } } }
    : undefined,
  ...buildDownloadERSFilters(query),
  ...buildDownloadEquipmentFilters(query),
  ...buildDownloadDateFilters(query),
  query.event_type
    ? {
        ers_parts_used: {
          some: {
            part_name: {
              contains: query.event_type,
              mode: "insensitive",
            },
          },
        },
      }
    : undefined,
  query.vmrs_code
    ? {
        workorder: {
          vmrsCodes: {
            some: {
              vmrs_Lookup: { vmrs_code: { contains: query.vmrs_code, mode: "insensitive" } },
            },
          },
        },
      }
    : undefined,
  buildWorkorderRefIdFilter(query.workorder_ref_id),
  buildVMRSCodesFilter(query.vmrsCodes),
  query.account_number
    ? { service_request: { account: { account_number: { contains: query.account_number, mode: "insensitive" } } } }
    : undefined,
  query.account_name
    ? { service_request: { account: { account_name: { contains: query.account_name, mode: "insensitive" } } } }
    : undefined,
  buildCustomerPOFilter(query.customer_po),
  buildAccountFilter(query.account),
];

/**
 * Helper function to format date fields for Excel export
 * @param value - Field value
 * @returns Formatted date value
 */
const formatDateField = (value: unknown): ExcelValue => {
  if (value instanceof Date) {
    return formatDate(value);
  } else if (typeof value === "number" || typeof value === "string") {
    return value;
  } else {
    return null;
  }
};

/**
 * Helper function to format event type field for Excel export
 * @param value - Field value
 * @returns Formatted event type value
 */
const formatEventTypeField = (value: unknown): ExcelValue => {
  if (Array.isArray(value)) {
    return value
      .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
      .join(", ");
  } else if (typeof value === "string") {
    return value;
  } else {
    return "";
  }
};

/**
 * Helper function to format default field for Excel export
 * @param value - Field value
 * @returns Formatted default value
 */
const formatDefaultField = (value: unknown): ExcelValue => {
  if (typeof value === "string" || typeof value === "number") {
    return value;
  } else if (value instanceof Date) {
    return formatDate(value);
  } else {
    return value ? JSON.stringify(value) : null;
  }
};

/**
 * Helper function to format field value for Excel export
 * @param field - Field name
 * @param value - Field value
 * @param index - Row index for serial number
 * @returns Formatted value for Excel
 */
const formatFieldValue = (field: string, value: unknown, index: number): ExcelValue => {
  switch (field) {
    case "sno":
      return index + 1;
    case "created_at":
    case "ers_end_date":
      return formatDateField(value);
    case "event_type":
      return formatEventTypeField(value);
    default:
      return formatDefaultField(value);
  }
};

/**
 * Helper function to build sorting configuration
 * @param query - Query parameters
 * @returns Sorting configuration
 */
const buildSortingConfig = (query: GetERSParams) => {
  let sortString: string | undefined;
  if (query.sort && typeof query.sort === "object") {
    sortString = Object.entries(query.sort)
      .map(([f, o]) => `${f}:${String(o)}`)
      .join(",");
  } else if (typeof query.sort === "string") {
    sortString = query.sort;
  }

  let orderBy = buildOrderByFromSort(sortString, ERS_SORT_FIELDS, "ers_id");
  if (!orderBy || orderBy.length === 0) {
    orderBy = [{ ers_id: "asc" }];
  }
  return orderBy;
};

/**
 * Helper function to transform ERS data for Excel export
 * @param ersRecords - Raw ERS records from database
 * @returns Transformed ERS data
 */
const transformERSData = (ersRecords: {
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
  } | null,
  workorder?: {
    workorder_id: number,
    workorder_ref_id: string | null,
    vmrsCodes?: {
      vmrs_Lookup: {
        vmrs_code: string
      }
    }[]
  } | null,
  ers_parts_used: { part_name: string }[],
  [key: string]: unknown
}[]) => {
  return ersRecords.map((ers) => {
    // Flatten vmrsCodes from related workorder
    const vmrsCodes = ers.workorder?.vmrsCodes?.map((v) => v.vmrs_Lookup.vmrs_code) ?? [];
    
    return {
      ...ers,
      account_id: ers.service_request?.account_id ?? null,
      equipment_id: ers.service_request?.equipment_id ?? null,
      unit_number: ers.service_request?.equipment_ref?.unit_number ?? null,
      customer_unit_number: ers.service_request?.equipment_ref?.customer_unit_number ?? null,
      account_number: ers.service_request?.account?.account_number ?? null,
      account_name: ers.service_request?.account?.account_name ?? null,
      customer_po: ers.service_request?.account?.customer?.customer_po ?? null,
      account: ers.service_request?.account 
        ? `${ers.service_request.account.account_name ?? ''} (${ers.service_request.account.account_number ?? ''})`.trim()
        : null,
      workorder_id: ers.workorder?.workorder_id ?? null,
      workorder_ref_id: ers.workorder?.workorder_ref_id ?? null,
      vmrsCodes,
      vmrs_code: vmrsCodes.length > 0 ? vmrsCodes.join(", ") : null,
      event_type: ers.ers_parts_used.map((p) => p.part_name).join(", "),
    };
  });
};

/**
 * Helper function to build ERS query filters
 * @param account_ids - Array of account IDs
 * @param processedParams - Processed query parameters
 * @returns Prisma where input for ERS queries
 */
const buildERSQueryFilters = (account_ids: number[], processedParams: Partial<GetERSParams>): Prisma.ersWhereInput => {
  return {
    AND: [
      account_ids.length > 0 ? { service_request: { account_id: { in: account_ids } } } : undefined,
      ...buildBasicFilters(processedParams),
      processedParams.created_at ? { created_at: buildDateRangeFilter(processedParams.created_at) } : undefined,
      processedParams.ers_end_date ? { ers_end_date: buildDateRangeFilter(processedParams.ers_end_date) } : undefined,
      buildAccountFilter(processedParams.account),
    ].filter(Boolean) as Prisma.ersWhereInput[],
  };
};

/**
 * Helper function to transform ERS list data
 * @param ersList - Raw ERS list from database
 * @returns Transformed ERS data
 */
const transformERSListData = (ersList: ERSListItem[]) => {
  return ersList.map((ers) => {
    const sr = ers.service_request;
    const vmrsCodes = ers.workorder?.vmrsCodes?.map((v) => v.vmrs_Lookup.vmrs_code) ?? [];

    return {
      ...ers,
      account_id: sr?.account_id ?? null,
      equipment_id: sr?.equipment_id ?? null,
      unit_number: sr?.equipment_ref?.unit_number ?? null,
      customer_unit_number: sr?.equipment_ref?.customer_unit_number ?? null,
      account_number: sr?.account?.account_number ?? null,
      account_name: sr?.account?.account_name ?? null,
      customer_po: sr?.account?.customer?.customer_po ?? null,
      account: sr?.account ? `${sr.account.account_name} (${sr.account.account_number})` : null,
      workorder_id: ers.workorder?.workorder_id ?? null,
      workorder_ref_id: ers.workorder?.workorder_ref_id ?? null,
      eventType: ers.ers_parts_used.map((p) => p.part_name),
      vmrsCodes,
      vmrs_code: vmrsCodes.length > 0 ? vmrsCodes.join(", ") : null,
    };
  });
};

/**
 * Fetches ERS records with filtering, pagination, and sorting
 * 
 * Supports complex filtering by:
 * - Account IDs (array or "all")
 * - ERS ID, reference ID, equipment ID
 * - Unit numbers (internal and customer)
 * - Location, status, service level
 * - Date ranges (created_at, ers_end_date)
 * - Event types and VMRS codes
 * - Account information (name, number)
 * 
 * @param params - Filtering and pagination parameters
 * @returns Paginated ERS data with flattened related information
 */
export const getERSService = async (
  params: GetERSParams
) => {
  const { account_ids = [], page, perPage, ...rest } = params;
  
  // Convert string parameters to numbers where needed
  const processedParams = {
    ...rest,
    equipment_id: rest.equipment_id ? safeNumber(rest.equipment_id) : undefined,
  };

  const { skip, take, page: currentPage, perPage: limit } = getPagination({ page, perPage });
  const filters = buildERSQueryFilters(Array.isArray(account_ids) ? account_ids : [], processedParams);
  const rawOrderBy = buildOrderByFromSort(rest.sort, ERS_SORT_FIELDS, "ers_id");

  const total = await prisma.ers.count({ where: filters });

  const ersList = await prisma.ers.findMany({
    where: filters,
    include: {
      service_request: {
        select: {
          equipment_id: true,
          account_id: true,
          account: { 
            select: { 
              account_number: true, 
              account_name: true,
              customer: {
                select: {
                  customer_po: true
                }
              }
            } 
          },
          equipment_ref: { select: { unit_number: true, customer_unit_number: true } },
        },
      },
      workorder: {
        select: {
          workorder_id: true,
          workorder_ref_id: true,
          vmrsCodes: {
            select: {
              vmrs_Lookup: {
                select: {
                  vmrs_code: true,
                },
              },
            },
          },
        },
      },
      ers_parts_used: true,
    },
    skip,
    take,
    orderBy: rawOrderBy,
  });

  const data = transformERSListData(ersList);
  return { data, total, page: currentPage, perPage: limit };
};


/**
 * Helper function to extract equipment data from ERS item
 * @param item - ERS item with service request data
 * @returns Equipment data object
 */
const extractEquipmentData = (item: ERSDetailsItem) => ({
  unit_number: item.service_request?.equipment_ref?.unit_number ?? null,
  equipment_description: item.service_request?.equipment_ref?.description ?? null,
  customer_unit_number: item.service_request?.equipment_ref?.customer_unit_number ?? null,
  vin: item.service_request?.equipment_ref?.vin ?? null,
});

/**
 * Helper function to extract customer and account data from ERS item
 * @param item - ERS item with service request data
 * @returns Customer and account data object
 */
const extractCustomerAccountData = (item: ERSDetailsItem) => ({
  customer_po: item.service_request?.account?.customer?.customer_po ?? null,
  account_name: item.service_request?.account?.account_name ?? null,
  account_number: item.service_request?.account?.account_number ?? null,
  account: item.service_request?.account 
    ? `${item.service_request.account.account_name ?? ''} (${item.service_request.account.account_number ?? ''})`.trim()
    : null,
});

/**
 * Helper function to extract workorder data from ERS item
 * @param item - ERS item with workorder data
 * @returns Workorder data object
 */
const extractWorkorderData = (item: ERSDetailsItem) => ({
  workorder_id: item.workorder?.workorder_id ?? null,
  workorder_ref_id: item.workorder?.workorder_ref_id ?? null,
  ten_care_event: item.workorder?.workorder_start_date ?? null,
  close_date: item.workorder?.workorder_end_date ?? null,
  open_date: item.workorder?.created_at ?? null,
  workorder_location: item.workorder?.location ?? null,
  workorder_service_state: item.workorder?.sservice_state ?? null,
  vmrs_data: item.workorder?.vmrs_data ? JSON.stringify(item.workorder.vmrs_data) : null,
  workorder_status: item.workorder?.workorder_status ?? null,
});

/**
 * Helper function to extract workorder VMRS data from ERS item
 * @param item - ERS item with workorder VMRS data
 * @returns Workorder VMRS data array
 */
const extractWorkorderVMRSData = (item: ERSDetailsItem) => {
  return item.workorder?.vmrsCodes?.map((vmrs) => ({
    workorder_id: vmrs.workorder_id,
    vmrs_id: vmrs.vmrs_id,
    workorder_part_cost: vmrs.workorder_part_cost,
    workorder_labour_cost: vmrs.workorder_labour_cost,
    workorder_totalCost: vmrs.workorder_totalCost,
    part_description: vmrs.part_description,
    created_at: vmrs.created_at,
    created_by: vmrs.created_by,
    updated_at: vmrs.updated_at,
    updated_by: vmrs.updated_by,
    vmrs_Lookup: {
      vmrs_id: vmrs.vmrs_Lookup.vmrs_id,
      vmrs_code: vmrs.vmrs_Lookup.vmrs_code,
      labor_cost: vmrs.vmrs_Lookup.labor_cost,
      part_cost: vmrs.vmrs_Lookup.part_cost,
      part_quantity: vmrs.vmrs_Lookup.part_quantity,
      vmrs_description: vmrs.vmrs_Lookup.vmrs_description,
      created_at: vmrs.vmrs_Lookup.created_at,
      created_by: vmrs.vmrs_Lookup.created_by,
      updated_at: vmrs.vmrs_Lookup.updated_at,
      updated_by: vmrs.vmrs_Lookup.updated_by
    }
  })) ?? [];
};

/**
 * Helper function to extract invoice data from ERS item
 * @param item - ERS item with invoice data
 * @returns Invoice data array
 */
const extractInvoiceData = (item: ERSDetailsItem) => {
  return item.workorder?.Invoice?.map((invoice) => ({
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    subTotal: invoice.subTotal,
    taxes: invoice.taxes,
    totalAmount: invoice.totalAmount,
    other_charges: invoice.other_charges,
    shop_supplies_charges: invoice.shop_supplies_charges
  })) ?? [];
};

/**
 * Helper function to extract user and communication data from ERS item
 * @param item - ERS item with user and communication data
 * @returns User and communication data object
 */
const extractUserCommunicationData = (item: ERSDetailsItem) => ({
  vendor_name: item.iot_device_vendor_ref?.vendor_name,
  created_by_name: item.created_by_user
    ? `${item.created_by_user.first_name} ${item.created_by_user.last_name}`.trim()
    : null,
  updated_by_name: item.updated_by_user
    ? `${item.updated_by_user.first_name} ${item.updated_by_user.last_name}`.trim()
    : null,
  communication_log: item.communication_log.length > 0
    ? {
        ...item.communication_log[0],
        from_to: `${item.communication_log[0].vendor_name} - ${item.communication_log[0].driver_name}`.trim(),
        reported_by: item.communication_log[0].driver_name,
      }
    : null,
});

/**
 * Helper function to extract attachment data from ERS item
 * @param item - ERS item with attachment data
 * @returns Attachment data array
 */
const extractAttachmentData = (item: ERSDetailsItem) => {
  return item.ers_has_attachment?.map((att) => ({
    ers_has_attachment_id: att.ers_has_attachment_id,
    date_uploaded: att.date_uploaded,
    expiration_date: att.expiration_date,
    attachment: {
      attachment_id: att.attachment_ref?.attachment_id,
      name: att.attachment_ref?.name,
      mime_type: att.attachment_ref?.mime_type,
      url: att.attachment_ref?.url,
      description: att.attachment_ref?.description,
      date_uploaded: att.attachment_ref?.date_uploaded,
      expiration_date: att.attachment_ref?.expiration_date,
    },
  })) ?? [];
};

/**
 * Helper function to transform ERS details item
 * @param item - Raw ERS item from database
 * @returns Transformed ERS details item
 */
const transformERSDetailsItem = (item: ERSDetailsItem) => ({
  ...item,
  ...extractEquipmentData(item),
  ...extractCustomerAccountData(item),
  ...extractWorkorderData(item),
  workorder_vmrs: extractWorkorderVMRSData(item),
  invoice: extractInvoiceData(item),
  ...extractUserCommunicationData(item),
  attachments: extractAttachmentData(item),
  event_type: item.ers_parts_used?.[0]?.part_name ?? null,
  
  // Remove nested objects to avoid duplication
  iot_device_vendor_ref: undefined,
  created_by_user: undefined,
  updated_by_user: undefined,
  ers_has_attachment: undefined,
  ers_parts_used: undefined,
});

/**
 * Fetches detailed ERS information including attachments and communication logs
 * 
 * Provides comprehensive ERS details with:
 * - Service request information
 * - Equipment and account references
 * - Communication logs with vendor and driver details
 * - File attachments with metadata
 * - Parts used information
 * - User audit information (created/updated by)
 * - Equipment details (unit_number, description, customer_unit_number, vin)
 * - Customer information (customer_po)
 * - Account information (account_name, account_number, combined account)
 * - Workorder details (workorder_id, workorder_ref_id, dates, location, vmrs_data, status)
 * - Workorder VMRS data (all fields)
 * - Invoice information (invoiceNumber, subTotal, taxes, totalAmount, other_charges, shop_supplies_charges)
 * 
 * @param params - Parameters for filtering ERS details
 * @returns Detailed ERS data with all related information
 */
export const getERSDetailsService = async (params: GetERSDetailsParams) => {
  const { page = 1, perPage = 10, account_id, equipment_id, ers_id } = params;

  const skip = (page - 1) * perPage;
  const take = perPage;

  // Build filters
  const filters: Prisma.ersWhereInput = {
    ...(ers_id && { ers_id }),
    ...(account_id && { service_request: { account_id } }),
    ...(equipment_id && { service_request: { equipment_id } }),
  };

  // Count total
  const total = await prisma.ers.count({ where: filters });

  // Fetch data with comprehensive includes
  const data = await prisma.ers.findMany({
    where: filters,
    skip,
    take,
    orderBy: { ers_id: "asc" },
    include: {
      service_request: {
        select: {
          service_request_id: true,
          account_id: true,
          equipment_id: true,
          equipment_ref: { 
            select: { 
              unit_number: true,
              description: true,
              customer_unit_number: true,
              vin: true
            } 
          },
          account: {
            select: {
              account_name: true,
              account_number: true,
              customer: {
                select: {
                  customer_po: true
                }
              }
            }
          }
        },
      },
      workorder: {
        select: {
          workorder_id: true,
          workorder_ref_id: true,
          workorder_start_date: true,
          workorder_end_date: true,
          created_at: true,
          location: true,
          sservice_state: true,
          vmrs_data: true,
          workorder_status: true,
          vmrsCodes: {
            select: {
              workorder_id: true,
              vmrs_id: true,
              workorder_part_cost: true,
              workorder_labour_cost: true,
              workorder_totalCost: true,
              part_description: true,
              line:true,
              is_billable:true,
              created_at: true,
              created_by: true,
              updated_at: true,
              updated_by: true,
              vmrs_Lookup: {
                select: {
                  vmrs_id: true,
                  vmrs_code: true,
                  labor_cost: true,
                  part_cost: true,
                  part_quantity: true,
                  vmrs_description: true,
                  created_at: true,
                  created_by: true,
                  updated_at: true,
                  updated_by: true
                }
              }
            }
          },
          Invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              subTotal: true,
              taxes: true,
              totalAmount: true,
              other_charges: true,
              shop_supplies_charges: true
            }
          }
        }
      },
      iot_device_vendor_ref: { select: { vendor_name: true } },
      created_by_user: { select: { first_name: true, last_name: true } },
      updated_by_user: { select: { first_name: true, last_name: true } },
      communication_log: true,
      ers_has_attachment: {
        include: { attachment_ref: true },
      },
      ers_parts_used: {
        select: { part_name: true },
      },
    },
  });

  // Transform response
  const formatted = data.map((item) => transformERSDetailsItem(item as unknown as ERSDetailsItem));

  return { data: formatted, total, page, perPage };
};

/**
 * Exports ERS data to Excel format with custom column configuration
 * 
 * Features:
 * - Supports all ERS filtering options
 * - Custom column selection and formatting
 * - Date formatting for Excel compatibility
 * - Handles large datasets with pagination
 * - Generates timestamped filenames
 * - Returns Excel buffer for download
 * 
 * @param payload - Query parameters and column definitions
 * @returns Excel buffer and filename for download
 */
export const downloadERSService = async (payload: {
  query: GetERSParams,
  columns: { label: string, field: string, maxWidth?: number }[]
}) => {
  const { query, columns: requestedColumns } = payload;

  // --- Handle account IDs ---
  const accountIdsArray = await handleAccountIdsForDownload(query);
  
  // --- Process query parameters ---
  const processedQuery = {
    ...query,
    equipment_id: query.equipment_id ? safeNumber(query.equipment_id) : undefined,
  };

  // --- Build filters ---
  const filters: Prisma.ersWhereInput = {
    AND: buildDownloadFilters(processedQuery, accountIdsArray).filter(Boolean) as Prisma.ersWhereInput[],
  };

  // --- Sorting ---
  const orderBy = buildSortingConfig(processedQuery);

  // --- Fetch ERS ---
  const ersRecords = await prisma.ers.findMany({
    where: filters,
    include: {
      service_request: {
        select: {
          equipment_id: true,
          account_id: true,
          // location_line1: true,
          equipment_ref: { 
            select: { 
              unit_number: true,
              customer_unit_number: true
            } 
          },
          account: {
            select: {
              account_number: true,
              account_name: true,
              customer: {
                select: {
                  customer_po: true
                }
              }
            }
          }
        },
      },
      workorder: {
        select: {
          workorder_id: true,
          workorder_ref_id: true,
          vmrsCodes: {
            select: {
              vmrs_Lookup: {
                select: {
                  vmrs_code: true,
                },
              },
            },
          },
        },
      },
      ers_parts_used: true,
    },
    orderBy,
  });

  // --- Transform data ---
  const transformedData = transformERSData(ersRecords);

  // --- Excel columns ---
  const excelColumns = requestedColumns.map(({ label, field, maxWidth }) => ({
    header: label,
    key: field,
    width: maxWidth ?? (field === "sno" ? 10 : 20),
    formatter: ["created_at", "ers_end_date"].includes(field)
      ? (val: unknown) =>
          val instanceof Date ? formatDate(val) : val ?? ""
      : undefined,
  }));

  // --- Excel rows ---
  const formattedData: Record<string, ExcelValue>[] =
    transformedData.map((ers, index) => {
      const row: Record<string, ExcelValue> = {};

      for (const { field } of requestedColumns) {
        const value = (ers as Record<string, unknown>)[field];
        row[field] = formatFieldValue(field, value, index);
      }

      return row;
    });

  // --- Filename ---
  const formatTimestampForFilename = (date: Date): string => {
    const isoString = date.toISOString();
    return isoString.split(':').join('-').split('.').join('-').slice(0, -5);
  };
  const timestamp = formatTimestampForFilename(new Date());
  const filename = `ers_${timestamp}.xlsx`;

  // --- Export Excel ---
  const exporter = new ExcelExporter();
  exporter.generateWorkbook({
    sheetName: "ERS",
    columns: excelColumns,
    data: formattedData,
    filename,
  });

  const buffer = await exporter.writeToBuffer();

  return { buffer, filename };
};