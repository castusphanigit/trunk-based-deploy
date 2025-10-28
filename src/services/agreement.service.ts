/**
 * Agreement Service
 *
 * Handles business logic for agreement-related operations including:
 * - Fetching lease and rental agreements with filtering and pagination
 * - Managing agreement details and equipment assignments
 * - Excel export functionality for agreements
 * - Complex data transformation and sorting operations
 *
 * Security considerations:
 * - Input validation and sanitization
 * - SQL injection prevention through Prisma ORM
 * - Data access authorization checks
 * - Memory management for large datasets
 *
 * @author Rajeswari
 * @version 1.0.0
 */

import prisma from "../config/database.config";
import {
  GetLeaseAgreementsParams,
  LeaseAgreementDetailsDTO,
} from "../types/dtos/agreement.dto";
import { buildOrderByFromSort } from "../utils/sort";
import { LEASE_AGREEMENT_SORT_FIELDS } from "../types/sorts/sortTypes";
import { ExcelExporter, formatDate } from "../utils/excelUtils";
import { InvoiceServices } from "./invoices.service";
import logger from "../utils/logger";
import { Prisma } from "@prisma/client";

// Constants for pagination and Excel export
const PAGINATION_CONSTANTS = {
  DEFAULT_PAGE: 1,
  DEFAULT_PER_PAGE: 10,
  MIN_PER_PAGE: 1,
} as const;

const EXCEL_CONSTANTS = {
  DEFAULT_COLUMN_WIDTH: 20,
  SERIAL_NUMBER_WIDTH: 10,
  DATE_COLUMN_WIDTH: 25,
  MAX_FILENAME_LENGTH: 50,
} as const;

const CONTRACT_TYPES = {
  LEASE: "L",
  RENTAL: "R",
} as const;

// Type definitions for detailed agreement processing
interface DetailedEquipmentRef {
  equipment_permit:
    | {
        license_plate_number: string | null;
        license_plate_state: string | null;
      }
    | null
    | undefined;
  equipment_reading?: {
    equipment_reading: unknown;
    reading_type: unknown;
    updated_at: unknown;
  }[];
  [key: string]: unknown;
}

interface DetailedAssignment {
  equipment_ref: DetailedEquipmentRef;
}

interface DetailedAllocation {
  unit_pickup_date: unknown;
  unit_turnedIn_date: unknown;
  account: unknown;
  equipment_assignment: DetailedAssignment[];
}

interface DetailedLineItem {
  schedule_agreement_line_item_id: unknown;
  rate: unknown;
  fixed_rate: unknown;
  variable_rate: unknown;
  number_of_months: unknown;
  equipment_type_allocation: DetailedAllocation[];
}
/**
 * Interface representing a single agreement row for data processing
 * Contains all relevant fields for agreement display and export
 */
export interface AgreementRow {
  equipment_id?: number;
  unit_number?: string;
  description?: string;
  schedule_agreement_id: number;
  schedule_agreement_ref?: string | null;
  agreement_type?: string;
  account_number?: string | null;
  account_name?: string | null;
  lease_po?: string | null;
  agreement_po?: string | null;
  contract_created_at?: Date | null;
  status?: string;
  start_date?: Date | null;
  termination_date?: Date | null;
  facility?: string;
}

/**
 * Type representing all possible keys for agreement row data
 * Includes the base AgreementRow keys plus the "sno" (serial number) field
 */
export type AgreementRowKey = keyof AgreementRow | "sno";

/**
 * Interface for defining Excel column configuration
 * Used for customizing column headers, field mappings, and formatting
 */
export interface RequestedColumn {
  label: string;
  field: AgreementRowKey;
  maxWidth?: number;
}

/**
 * Builds date filters for lease agreement queries
 */
const buildLeaseDateFilters = (params: GetLeaseAgreementsParams) => {
  const { contract_start_date, contract_end_date } = params;
  const filters: Record<string, unknown> = {};

  if (contract_start_date) {
    filters.effective_date = {
      gte: new Date(`${contract_start_date}T00:00:00.000Z`),
      lt: new Date(`${contract_start_date}T23:59:59.999Z`),
    };
  }

  if (contract_end_date) {
    filters.termination_date = {
      gte: new Date(`${contract_end_date}T00:00:00.000Z`),
      lt: new Date(`${contract_end_date}T23:59:59.999Z`),
    };
  }

  return filters;
};

/**
 * Builds basic field filters for lease agreement queries
 */
const buildLeaseBasicFilters = (params: GetLeaseAgreementsParams) => {
  const {
    agreement_type,
    schedule_agreement_id,
    status,
    facility,
    schedule_agreement_ref,
    agreement_po,
  } = params;
  const filters: Prisma.schedule_agreementWhereInput = {};

  if (agreement_type) {
    filters.schedule_type = { contains: agreement_type, mode: "insensitive" };
  }

  if (schedule_agreement_id) {
    filters.schedule_agreement_id =
      typeof schedule_agreement_id === "string"
        ? Number(schedule_agreement_id)
        : schedule_agreement_id;
  }

  if (status) {
    filters.schedule_agreement_status_lookup = {
      field_code: { contains: status, mode: "insensitive" },
    };
  }

  if (facility) {
    filters.facility_lookup_ref = {
      facility_code: { contains: facility, mode: "insensitive" },
    };
  }

  if (schedule_agreement_ref) {
    filters.schedule_agreement_ref = {
      contains: schedule_agreement_ref,
      mode: "insensitive" as const,
    };
  }

  if (agreement_po) {
    filters.agreement_po = {
      contains: agreement_po,
      mode: "insensitive" as const,
    };
  }

  return filters;
};

/**
 * Builds contract type lookup filters for lease agreements
 */
const buildLeaseContractTypeFilters = (params: GetLeaseAgreementsParams) => {
  const { contract_panel_type, contract_created_at } = params;
  const filters: Record<string, unknown> = {
    contract_panel_type: contract_panel_type ?? CONTRACT_TYPES.LEASE,
  };

  if (contract_panel_type) {
    filters.contract_panel_type = {
      contains: contract_panel_type,
      mode: "insensitive",
    };
  }

  if (contract_created_at) {
    filters.created_at = { gte: new Date(contract_created_at) };
  }

  return filters;
};

/**
 * Builds equipment assignment filters for agreements
 */
const buildEquipmentFilters = (params: GetLeaseAgreementsParams) => {
  const { unit_number, description } = params;
  const filters: Record<string, unknown> = {};

  if (unit_number) {
    filters.equipment_assignment = {
      some: {
        equipment_ref: {
          unit_number: {
            contains: unit_number,
            mode: "insensitive",
          },
        },
      },
    };
  }

  if (description) {
    filters.equipment_assignment = {
      some: {
        equipment_ref: {
          description: {
            contains: description,
            mode: "insensitive",
          },
        },
      },
    };
  }

  return filters;
};

/**
 * Builds account filters for agreements
 */
const buildAccountFilters = (
  params: GetLeaseAgreementsParams,
  safeAccountIds: number[]
) => {
  const { account_number, account_name } = params;
  const hasAccountIds = safeAccountIds.length > 0;
  const hasAccountNumber = Boolean(account_number);
  const hasAccountName = Boolean(account_name);

  if (!hasAccountIds && !hasAccountNumber && !hasAccountName) {
    return {};
  }

  const accountFilters: Record<string, unknown> = {};

  if (hasAccountIds) {
    accountFilters.account_id = { in: safeAccountIds };
  }

  if (hasAccountNumber) {
    accountFilters.account_number = {
      contains: account_number,
      mode: "insensitive" as Prisma.QueryMode,
    };
  }

  if (hasAccountName) {
    accountFilters.account_name = {
      contains: account_name,
      mode: "insensitive" as Prisma.QueryMode,
    };
  }

  return { account: accountFilters };
};

/**
 * Builds the where clause for lease agreement queries
 */
const buildLeaseAgreementWhereClause = (
  params: GetLeaseAgreementsParams,
  safeAccountIds: number[]
): Prisma.schedule_agreementWhereInput => {
  const equipmentFilters = buildEquipmentFilters(params);
  const accountFilters = buildAccountFilters(params, safeAccountIds);

  return {
    ...buildLeaseDateFilters(params),
    ...buildLeaseBasicFilters(params),
    contract_type_lookup_ref: buildLeaseContractTypeFilters(params),
    schedule_agreement_line_item: {
      some: {
        equipment_type_allocation: {
          some: {
            ...equipmentFilters,
            ...accountFilters,
          },
        },
      },
    },
  };
};

/**
 * Processes in-memory sorting for agreement rows
 */
const processInMemorySorting = (
  allRows: AgreementRow[],
  inMemorySorts: { field: string; direction: "asc" | "desc" }[]
): void => {
  type Sortable = string | number | Date | null;

  for (const sort of inMemorySorts) {
    const { field, direction } = sort;
    allRows.sort((a, b) => {
      const valA = (a as unknown as Record<string, Sortable>)[field] ?? "";
      const valB = (b as unknown as Record<string, Sortable>)[field] ?? "";

      // Convert Dates properly before comparing
      const normalizedA = valA instanceof Date ? valA.getTime() : String(valA);
      const normalizedB = valB instanceof Date ? valB.getTime() : String(valB);

      return (
        String(normalizedA).localeCompare(String(normalizedB)) *
        (direction === "asc" ? 1 : -1)
      );
    });
  }
};

// Type definitions for Prisma query results
interface EquipmentRef {
  equipment_id?: number;
  unit_number?: string;
  description?: string;
}

interface Account {
  account_number?: string | null;
  account_name?: string | null;
}

interface Agreement {
  schedule_agreement_id: number;
  schedule_agreement_ref?: string | null;
  agreement_po?: string | null;
  schedule_type?: string;
  contract_type_lookup_ref?: {
    contract_panel_type?: string | null;
    created_at?: Date;
  };
  schedule_agreement_status_lookup?: {
    field_code?: string;
  };
  effective_date?: Date;
  termination_date?: Date;
  facility_lookup_ref?: {
    facility_code?: string;
  };
}

interface EquipmentAssignment {
  equipment_ref: EquipmentRef;
}

interface EquipmentTypeAllocation {
  account: Account;
  equipment_assignment: EquipmentAssignment[];
}

/**
 * Transforms equipment assignment to agreement row
 */
const transformEquipmentAssignment = (
  assign: EquipmentAssignment,
  alloc: EquipmentTypeAllocation,
  agreement: Agreement
): AgreementRow => {
  const equipment = assign.equipment_ref;
  const acc = alloc.account;
  return {
    equipment_id: equipment?.equipment_id ?? undefined,
    unit_number: equipment?.unit_number ?? undefined,
    description: equipment?.description ?? undefined,
    schedule_agreement_id: agreement.schedule_agreement_id,
    schedule_agreement_ref: agreement.schedule_agreement_ref ?? undefined,
    agreement_type: agreement.schedule_type,
    account_number: acc?.account_number ?? undefined,
    account_name: acc?.account_name ?? undefined,
    lease_po:
      agreement.contract_type_lookup_ref?.contract_panel_type ?? undefined,
    agreement_po: agreement.agreement_po ?? undefined,
    contract_created_at:
      agreement.contract_type_lookup_ref?.created_at ?? undefined,
    status: agreement.schedule_agreement_status_lookup?.field_code ?? undefined,
    start_date: agreement.effective_date ?? undefined,
    termination_date: agreement.termination_date ?? undefined,
    facility: agreement.facility_lookup_ref?.facility_code ?? undefined,
  };
};

/**
 * Processes equipment assignments for a single allocation
 */
const processEquipmentAssignments = (
  alloc: EquipmentTypeAllocation,
  agreement: Agreement,
  result: AgreementRow[],
  unit_number?: string
): void => {
  for (const assign of alloc.equipment_assignment) {
    if (
      unit_number &&
      !assign.equipment_ref?.unit_number?.includes(unit_number)
    ) {
      continue;
    }

    result.push(transformEquipmentAssignment(assign, alloc, agreement));
  }
};

interface LineItem {
  equipment_type_allocation: EquipmentTypeAllocation[];
}

/**
 * Processes equipment type allocations for a single line item
 */
const processEquipmentTypeAllocations = (
  line: LineItem,
  agreement: Agreement,
  result: AgreementRow[],
  unit_number?: string,
  account_number?: string
): void => {
  for (const alloc of line.equipment_type_allocation) {
    if (account_number && alloc.account?.account_number !== account_number) {
      continue;
    }

    processEquipmentAssignments(alloc, agreement, result, unit_number);
  }
};

interface AgreementWithLineItems extends Agreement {
  schedule_agreement_line_item: LineItem[];
}

/**
 * Flattens agreement data into rows
 */
const flattenAgreementData = (
  agreements: AgreementWithLineItems[],
  unit_number?: string,
  account_number?: string
): AgreementRow[] => {
  const result: AgreementRow[] = [];

  for (const agreement of agreements) {
    for (const line of agreement.schedule_agreement_line_item) {
      processEquipmentTypeAllocations(
        line,
        agreement,
        result,
        unit_number,
        account_number
      );
    }
  }

  return result;
};

/**
 * Processes sorting configuration for agreements
 */
const processAgreementSorting = (sort: string | undefined) => {
  const rawOrderBy = buildOrderByFromSort(
    sort,
    LEASE_AGREEMENT_SORT_FIELDS,
    "schedule_agreement_id"
  );

  const inMemorySorts: { field: string; direction: "asc" | "desc" }[] = [];

  const orderBy: Prisma.schedule_agreementOrderByWithRelationInput[] =
    rawOrderBy.filter((o: Record<string, unknown>) => {
      if ("_inMemoryAccountNumberSort" in o) {
        inMemorySorts.push({
          field: "account_number",
          direction: o._inMemoryAccountNumberSort as "asc" | "desc",
        });
        return false;
      }
      if ("_inMemoryAccountNameSort" in o) {
        inMemorySorts.push({
          field: "account_name",
          direction: o._inMemoryAccountNameSort as "asc" | "desc",
        });
        return false;
      }
      if ("_inMemoryUnitNumberSort" in o) {
        inMemorySorts.push({
          field: "unit_number",
          direction: o._inMemoryUnitNumberSort as "asc" | "desc",
        });
        return false;
      }
      if ("_inMemoryDescriptionSort" in o) {
        inMemorySorts.push({
          field: "description",
          direction: o._inMemoryDescriptionSort as "asc" | "desc",
        });
        return false;
      }
      if ("_inMemoryScheduleAgreementRefSort" in o) {
        inMemorySorts.push({
          field: "schedule_agreement_ref",
          direction: o._inMemoryScheduleAgreementRefSort as "asc" | "desc",
        });
        return false;
      }
      if ("_inMemoryAgreementPoSort" in o) {
        inMemorySorts.push({
          field: "agreement_po",
          direction: o._inMemoryAgreementPoSort as "asc" | "desc",
        });
        return false;
      }
      return true;
    }) as Prisma.schedule_agreementOrderByWithRelationInput[];

  if (!orderBy || orderBy.length === 0) {
    orderBy.push({ schedule_agreement_id: "asc" });
  }

  return { orderBy, inMemorySorts };
};

/**
 * Fetches agreements from database
 */
const fetchAgreements = async (
  where: Prisma.schedule_agreementWhereInput,
  orderBy: Prisma.schedule_agreementOrderByWithRelationInput[]
) => {
  return await prisma.schedule_agreement.findMany({
    where,
    select: {
      schedule_agreement_id: true,
      schedule_agreement_ref: true,
      agreement_po: true,
      schedule_type: true,
      effective_date: true,
      termination_date: true,
      status: true,
      facility_lookup_ref: true,
      contract_type_lookup_ref: true,
      schedule_agreement_status_lookup: true,
      schedule_agreement_line_item: {
        include: {
          equipment_type_allocation: {
            include: {
              account: {
                select: {
                  account_id: true,
                  account_number: true,
                  account_name: true,
                },
              },
              equipment_assignment: {
                include: {
                  equipment_ref: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy,
  });
};

/**
 * Processes and paginates agreement data
 */
const processAgreementData = (
  agreements: AgreementWithLineItems[],
  unit_number: string | undefined,
  account_number: string | undefined,
  inMemorySorts: { field: string; direction: "asc" | "desc" }[],
  page: number,
  perPage: number
) => {
  // Sort agreements by account number
  agreements.sort((a, b) => {
    const accA =
      a.schedule_agreement_line_item[0]?.equipment_type_allocation[0]?.account;
    const accB =
      b.schedule_agreement_line_item[0]?.equipment_type_allocation[0]?.account;

    const valA = accA?.account_number ?? "";
    const valB = accB?.account_number ?? "";

    return valA.localeCompare(valB);
  });

  // Flatten data
  const allRows = flattenAgreementData(agreements, unit_number, account_number);

  // In-memory sorting
  processInMemorySorting(allRows, inMemorySorts);

  // Pagination
  const totalCount = allRows.length;
  const totalPages = perPage > 0 ? Math.ceil(totalCount / perPage) : 0;
  const start = (page - 1) * perPage;
  const pagedData =
    start >= totalCount ? [] : allRows.slice(start, start + perPage);

  return { data: pagedData, total: totalCount, page, perPage, totalPages };
};

/**
 * Fetches lease agreements with filtering, sorting, and pagination
 *
 * @param params - Query parameters including filters, pagination, and sorting options
 * @returns Promise containing paginated lease agreement data
 *
 * @throws {Error} When database query fails or invalid parameters provided
 *
 * @example
 * ```typescript
 * const result = await getLeaseAgreementsService({
 *   account_ids: [1, 2, 3],
 *   page: 1,
 *   perPage: 10,
 *   sort: "account_number:asc"
 * });
 * ```
 */
export const getLeaseAgreementsService = async (
  params: GetLeaseAgreementsParams
) => {
  const { account_ids = [], account_number, unit_number, sort } = params;

  let {
    page = PAGINATION_CONSTANTS.DEFAULT_PAGE,
    perPage = PAGINATION_CONSTANTS.DEFAULT_PER_PAGE,
  } = params;

  page = page || PAGINATION_CONSTANTS.DEFAULT_PAGE;
  perPage = perPage || PAGINATION_CONSTANTS.DEFAULT_PER_PAGE;

  // Clean account_ids: must be strictly numbers
  const safeAccountIds: number[] = Array.isArray(account_ids)
    ? account_ids.filter((id): id is number => typeof id === "number")
    : [];

  // Build where clause
  const where = buildLeaseAgreementWhereClause(params, safeAccountIds);

  // Process sorting
  const { orderBy, inMemorySorts } = processAgreementSorting(sort);

  // Fetch agreements
  const agreements = await fetchAgreements(where, orderBy);

  // Process and paginate data
  return processAgreementData(
    agreements,
    unit_number,
    account_number,
    inMemorySorts,
    page,
    perPage
  );
};

/**
 * Builds contract type lookup filters for rental agreements
 */
const buildRentalContractTypeFilters = (params: GetLeaseAgreementsParams) => {
  const { contract_panel_type, contract_created_at } = params;
  const filters: Record<string, unknown> = {
    contract_panel_type: contract_panel_type ?? CONTRACT_TYPES.RENTAL,
  };

  if (contract_panel_type) {
    filters.contract_panel_type = {
      contains: contract_panel_type,
      mode: "insensitive",
    };
  }

  if (contract_created_at) {
    filters.created_at = { gte: new Date(contract_created_at) };
  }

  return filters;
};

/**
 * Builds the where clause for rental agreement queries
 */
const buildRentalAgreementWhereClause = (
  params: GetLeaseAgreementsParams,
  safeAccountIds: number[]
): Prisma.schedule_agreementWhereInput => {
  const equipmentFilters = buildEquipmentFilters(params);
  const accountFilters = buildAccountFilters(params, safeAccountIds);

  return {
    ...buildLeaseDateFilters(params),
    ...buildLeaseBasicFilters(params),
    contract_type_lookup_ref: buildRentalContractTypeFilters(params),
    schedule_agreement_line_item: {
      some: {
        equipment_type_allocation: {
          some: {
            ...equipmentFilters,
            ...accountFilters,
          },
        },
      },
    },
  };
};

/**
 * Fetches rental agreements with filtering, sorting, and pagination
 * Similar to lease agreements but filters for rental contract types
 *
 * @param params - Query parameters including filters, pagination, and sorting options
 * @returns Promise containing paginated rental agreement data
 *
 * @throws {Error} When database query fails or invalid parameters provided
 *
 * @example
 * ```typescript
 * const result = await getRentalAgreementsService({
 *   account_ids: [1, 2, 3],
 *   page: 1,
 *   perPage: 10,
 *   contract_panel_type: "R"
 * });
 * ```
 */
export const getRentalAgreementsService = async (
  params: GetLeaseAgreementsParams
) => {
  const { account_ids = [], account_number, unit_number, sort } = params;

  let {
    page = PAGINATION_CONSTANTS.DEFAULT_PAGE,
    perPage = PAGINATION_CONSTANTS.DEFAULT_PER_PAGE,
  } = params;

  page = page || PAGINATION_CONSTANTS.DEFAULT_PAGE;
  perPage = perPage || PAGINATION_CONSTANTS.DEFAULT_PER_PAGE;

  // Clean account_ids
  const safeAccountIds: number[] = Array.isArray(account_ids)
    ? account_ids.filter((id): id is number => typeof id === "number")
    : [];

  // Build where clause
  const where = buildRentalAgreementWhereClause(params, safeAccountIds);

  // Process sorting
  const { orderBy, inMemorySorts } = processAgreementSorting(sort);

  // Fetch agreements
  const agreements = await fetchAgreements(where, orderBy);

  // Process and paginate data
  return processAgreementData(
    agreements,
    unit_number,
    account_number,
    inMemorySorts,
    page,
    perPage
  );
};

/**
 * Helper function to process detailed line items for agreement details
 */
const processDetailedLineItems = (lineItems: DetailedLineItem[]) => {
  return lineItems
    .map((lineItem: DetailedLineItem) => {
      const equipment_type_allocation = lineItem.equipment_type_allocation
        .map((allocation: DetailedAllocation) => {
          const equipment_assignment = allocation.equipment_assignment.map(
            (assign: DetailedAssignment) => {
              // destructure to strip out `equipment_permit`
              const { equipment_permit, ...restEquipment } =
                assign.equipment_ref;

              return {
                equipment_ref: {
                  ...restEquipment,
                  equipment_reading:
                    restEquipment.equipment_reading?.[0] ?? null,
                  permit: equipment_permit
                    ? {
                        license_plate_number:
                          equipment_permit.license_plate_number ?? "",
                        license_plate_state:
                          equipment_permit.license_plate_state ?? "",
                      }
                    : {
                        license_plate_number: "",
                        license_plate_state: "",
                      },
                  unit_pickup_date: allocation.unit_pickup_date,
                  unit_turnedIn_date: allocation.unit_turnedIn_date,
                },
              };
            }
          );

          if (equipment_assignment.length === 0) return null;

          return {
            equipment_assignment,
            account: allocation.account,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      if (equipment_type_allocation.length === 0) return null;

      return {
        schedule_agreement_line_item_id:
          lineItem.schedule_agreement_line_item_id,
        rate: lineItem.rate,
        fixed_rate: lineItem.fixed_rate,
        variable_rate: lineItem.variable_rate,
        number_of_months: lineItem.number_of_months,
        equipment_type_allocation,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);
};

/**
 * Converts BigInt → string recursively, preserve Date objects
 */
const serializeBigInt = (obj: unknown): unknown => {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return obj.toString();
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeBigInt);
  if (typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [k, serializeBigInt(v)])
    );
  }
  return obj;
};

/**
 * Fetches agreement details from database with complex includes
 */
const fetchAgreementDetails = async (
  schedule_agreement_id: number,
  equipment_id: number
) => {
  return await prisma.schedule_agreement.findUnique({
    where: { schedule_agreement_id },
    include: {
      master_agreement_ref: {
        select: {
          master_agreement_id: true,
          master_agreement_ref: true,
          contract_term_type: true,
          contract_effective_date: true,
          contract_term: true,
          contract_billing_method: true,
          contract_end_date: true,
          contract_start_Date: true,
          status: true,
          attachments: {
            include: {
              attachment: {
                select: { url: true, name: true },
              },
            },
          },
          schedule_agreement: {
            select: {
              schedule_agreement_ref: true,
              schedule_type: true,
              termination_date: true,
              early_termination_date: true,
              schedule_agreement_has_attachment: {
                select: {
                  attachment: {
                    select: { url: true, name: true },
                  },
                },
              },
              effective_date: true,
              contract_term: true,
              contract_term_type: true,
              contract_billing_method: true,
              agreement_po: true,
              schedule_agreement_date: true,
              status: true,
            },
          },
        },
      },
      facility_lookup_ref: {
        select: {
          facility_code: true,
          facility_name: true,
          facility_description: true,
        },
      },
      contract_type_lookup_ref: {
        select: {
          contract_panel_type: true,
          description: true,
          unit_of_measurement: true,
          non_cancellable_months: true,
        },
      },
      schedule_agreement_line_item: {
        include: {
          equipment_type_allocation: {
            include: {
              account: {
                select: {
                  account_id: true,
                  account_name: true,
                  account_number: true,
                  customer: {
                    select: {
                      customer_pool: true,
                      reservation: true,
                    },
                  },
                },
              },
              equipment_assignment: {
                where: { equipment_ref: { equipment_id } },
                include: {
                  equipment_ref: {
                    include: {
                      equipment_reading: {
                        orderBy: { updated_at: "desc" },
                        take: 1,
                        select: {
                          equipment_reading: true,
                          reading_type: true,
                          updated_at: true,
                        },
                      },
                      equipment_type_lookup_ref: {
                        select: {
                          equipment_type: true,
                          equipment_type_lookup_id: true,
                        },
                      },
                      oem_make_model_ref: {
                        select: {
                          make: true,
                          model: true,
                          year: true,
                          length: true,
                        },
                      },
                      equipment_attachment_ref: {
                        include: {
                          attachment_ref: {
                            select: { url: true, name: true },
                          },
                        },
                      },
                      equipment_permit: {
                        select: {
                          license_plate_number: true,
                          license_plate_state: true,
                        },
                      },
                      gate_inspections: {
                        where: {
                          OR: [{ reason: "INBOUND" }, { reason: "OUTBOUND" }],
                        },
                        orderBy: [
                          { reason: "asc" },
                          { inspection_date: "desc" },
                        ],
                        include: {
                          attachments: {
                            include: {
                              attachment_ref: {
                                select: {
                                  url: true,
                                  name: true,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
};

/**
 * Fetches invoice history for the agreement
 */
const fetchInvoiceHistory = async (
  account_id: number | undefined,
  includeInvoiceHistory: boolean,
  invoiceQuery?: {
    page?: number;
    perPage?: number;
    sort?: string;
    status?: string;
    invoiceType?: string;
    dateFrom?: string;
    dateTo?: string;
  }
) => {
  if (!includeInvoiceHistory || !account_id || !invoiceQuery) {
    return undefined;
  }

  try {
    const invoiceService = new InvoiceServices();
    return await invoiceService.getInvoicesByAccountIdWithPagination(
      account_id,
      invoiceQuery
    );
  } catch (error) {
    logger.error("Failed to fetch invoice history", {
      error: error instanceof Error ? error.message : String(error),
      account_id,
    });
    return undefined;
  }
};

// Type definitions for agreement details processing
interface AgreementDetailsData {
  schedule_agreement_id: number;
  master_agreement_ref: {
    attachments: { attachment: { url: string; name: string } }[];
    [key: string]: unknown;
  };
  facility_lookup_ref: {
    facility_code: string;
    facility_name: string;
    facility_description: string;
  } | null;
  contract_type_lookup_ref: {
    contract_panel_type: string | null;
    description: string | null;
    unit_of_measurement: string | null;
    non_cancellable_months: number | null;
  } | null;
  schedule_agreement_line_item: {
    daily_rate?: number | null;
    weekly_rate?: number | null;
    monthly_rate?: number | null;
    billing_info?: string | null;
    equipment_type_allocation?: {
      account?: {
        account_id?: number;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    }[];
    [key: string]: unknown;
  }[];
}

interface LineItemWithRates {
  daily_rate?: number | null;
  weekly_rate?: number | null;
  monthly_rate?: number | null;
  billing_info?: string | null;
}

/**
 * Extracts rate fields from line item for lease contracts
 */
const extractRateFields = (
  agreement: AgreementDetailsData,
  firstLineItem: LineItemWithRates | undefined
): Record<string, unknown> => {
  const isLeaseContract =
    agreement.contract_type_lookup_ref?.contract_panel_type === "R";

  if (!isLeaseContract || !firstLineItem) {
    return {};
  }

  return {
    daily_rate: firstLineItem.daily_rate,
    weekly_rate: firstLineItem.weekly_rate,
    monthly_rate: firstLineItem.monthly_rate,
    billing_info: firstLineItem.billing_info,
  };
};

/**
 * Builds the response object for agreement details
 */
const buildAgreementDetailsResponse = (
  agreement: AgreementDetailsData,
  lineItems: unknown,
  invoiceHistory: unknown,
  rateFields: Record<string, unknown>
) => {
  const masterAgreementAttachments =
    agreement.master_agreement_ref.attachments.map((a) => a.attachment);

  return serializeBigInt({
    schedule_agreement_id: agreement.schedule_agreement_id,
    masterAgreement: {
      ...agreement.master_agreement_ref,
      attachments: masterAgreementAttachments,
    },
    facility: agreement.facility_lookup_ref,
    lineItems,
    invoiceHistory,
    contract_type_description: agreement.contract_type_lookup_ref?.description,
    unit_of_measurement:
      agreement.contract_type_lookup_ref?.unit_of_measurement,
    non_cancellable_months:
      agreement.contract_type_lookup_ref?.non_cancellable_months,
    contract_panel_type:
      agreement.contract_type_lookup_ref?.contract_panel_type,
    ...rateFields,
  }) as LeaseAgreementDetailsDTO;
};

/**
 * Fetches detailed information for a specific lease agreement and equipment
 * Includes master agreement details, line items, equipment assignments, and attachments
 *
 * @param schedule_agreement_id - The unique identifier for the schedule agreement
 * @param equipment_id - The unique identifier for the equipment
 * @returns Promise containing detailed agreement information or null if not found
 *
 * @throws {Error} When database query fails or invalid parameters provided
 *
 * @example
 * ```typescript
 * const details = await getLeaseAgreementDetailsService(123, 456);
 * if (details) {
 *   console.log(details.masterAgreement.contract_term);
 * }
 * ```
 */
export const getLeaseAgreementDetailsService = async (
  schedule_agreement_id: number,
  equipment_id: number,
  includeInvoiceHistory = false,
  invoiceQuery?: {
    page?: number;
    perPage?: number;
    sort?: string;
    status?: string;
    invoiceType?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): Promise<LeaseAgreementDetailsDTO | null> => {
  const agreement = (await fetchAgreementDetails(
    schedule_agreement_id,
    equipment_id
  )) as AgreementDetailsData | null;

  if (!agreement) return null;

  const lineItems = processDetailedLineItems(
    agreement.schedule_agreement_line_item as unknown as DetailedLineItem[]
  );

  const account_id =
    agreement.schedule_agreement_line_item[0]?.equipment_type_allocation?.[0]
      ?.account?.account_id;

  const invoiceHistory = await fetchInvoiceHistory(
    account_id,
    includeInvoiceHistory,
    invoiceQuery
  );

  const firstLineItem = agreement.schedule_agreement_line_item[0] as
    | LineItemWithRates
    | undefined;
  const rateFields = extractRateFields(agreement, firstLineItem);

  return buildAgreementDetailsResponse(
    agreement,
    lineItems,
    invoiceHistory,
    rateFields
  );
};

/**
 * Handles account IDs for download queries
 */
const handleAccountIdsForDownload = async (
  query: GetLeaseAgreementsParams
): Promise<number[]> => {
  if (query.account_ids === "all") {
    if (query.downloadAll) {
      const allAccounts = await prisma.schedule_agreement_line_item.findMany({
        select: { equipment_type_allocation: { select: { account_id: true } } },
      });
      return allAccounts
        .flatMap((li) => li.equipment_type_allocation.map((e) => e.account_id))
        .filter((id): id is number => id !== null);
    } else {
      throw new Error(
        "Please pass specific accountIds for download when 'all' is selected"
      );
    }
  } else if (Array.isArray(query.account_ids)) {
    return query.account_ids.map((id) => id).filter(Boolean);
  }
  return [];
};

/**
 * Builds date filters for download queries
 */
const buildDateFilters = (query: GetLeaseAgreementsParams) => {
  const filters: Record<string, unknown> = {};

  if (query.contract_start_date) {
    filters.effective_date = {
      gte: new Date(`${query.contract_start_date}T00:00:00.000Z`),
      lt: new Date(`${query.contract_start_date}T23:59:59.999Z`),
    };
  }

  if (query.contract_end_date) {
    filters.termination_date = {
      gte: new Date(`${query.contract_end_date}T00:00:00.000Z`),
      lt: new Date(`${query.contract_end_date}T23:59:59.999Z`),
    };
  }

  return filters;
};

/**
 * Builds basic field filters for download queries
 */
const buildBasicFilters = (query: GetLeaseAgreementsParams) => {
  const filters: Prisma.schedule_agreementWhereInput = {};

  if (query.agreement_type) {
    filters.schedule_type = {
      contains: query.agreement_type,
      mode: "insensitive",
    };
  }

  if (query.schedule_agreement_id) {
    filters.schedule_agreement_id = query.schedule_agreement_id;
  }

  if (query.status) {
    filters.schedule_agreement_status_lookup = {
      field_code: { contains: query.status, mode: "insensitive" },
    };
  }

  if (query.facility) {
    filters.facility_lookup_ref = {
      facility_code: { contains: query.facility, mode: "insensitive" },
    };
  }

  if (query.schedule_agreement_ref) {
    filters.schedule_agreement_ref = {
      contains: query.schedule_agreement_ref,
      mode: "insensitive" as const,
    };
  }

  if (query.agreement_po) {
    filters.agreement_po = {
      contains: query.agreement_po,
      mode: "insensitive" as const,
    };
  }

  return filters;
};

/**
 * Builds contract type lookup filters
 */
const buildContractTypeFilters = (query: GetLeaseAgreementsParams) => {
  const filters: Record<string, unknown> = {
    contract_panel_type: query.contract_panel_type ?? CONTRACT_TYPES.RENTAL,
  };

  if (query.contract_created_at) {
    filters.created_at = { gte: new Date(query.contract_created_at) };
  }

  return filters;
};

/**
 * Builds equipment reference filters
 */
const buildEquipmentRefFilters = (query: GetLeaseAgreementsParams) => {
  const filters: Record<string, unknown> = {};

  if (query.unit_number) {
    filters.unit_number = {
      contains: query.unit_number,
      mode: "insensitive",
    };
  }

  if (query.description) {
    filters.description = {
      contains: query.description,
      mode: "insensitive",
    };
  }

  return filters;
};

/**
 * Builds account filters for download queries
 */
const buildDownloadAccountFilters = (
  query: GetLeaseAgreementsParams,
  accountIdsArray: number[]
) => {
  const hasAccountIds = accountIdsArray.length > 0;
  const hasAccountNumber = Boolean(query.account_number);
  const hasAccountName = Boolean(query.account_name);

  if (!hasAccountIds && !hasAccountNumber && !hasAccountName) {
    return {};
  }

  const accountFilters: Record<string, unknown> = {};

  if (accountIdsArray.length > 0) {
    accountFilters.account_id = { in: accountIdsArray };
  }

  if (query.account_number) {
    accountFilters.account_number = {
      contains: query.account_number,
      mode: "insensitive",
    };
  }

  if (query.account_name) {
    accountFilters.account_name = {
      contains: query.account_name,
      mode: "insensitive",
    };
  }

  return { account: accountFilters };
};

/**
 * Builds where clause for download queries
 */
const buildDownloadWhereClause = (
  query: GetLeaseAgreementsParams,
  accountIdsArray: number[]
): Prisma.schedule_agreementWhereInput => {
  return {
    ...buildDateFilters(query),
    ...buildBasicFilters(query),
    contract_type_lookup_ref: buildContractTypeFilters(query),
    schedule_agreement_line_item: {
      some: {
        equipment_type_allocation: {
          some: {
            equipment_assignment: {
              some: {
                equipment_ref: buildEquipmentRefFilters(query),
              },
            },
            ...buildDownloadAccountFilters(query, accountIdsArray),
          },
        },
      },
    },
  };
};

/**
 * Normalizes sort parameter for download queries
 */
const normalizeSortForDownload = (
  sort: string | Record<string, "asc" | "desc"> | undefined
): string | undefined => {
  const isValidObject =
    sort && typeof sort === "object" && !Array.isArray(sort);

  if (!isValidObject) {
    return sort as string | undefined;
  }

  const [field, dir] = Object.entries(sort)[0];
  return `${field}:${dir}`;
};

/**
 * Processes download equipment assignments
 */
const processDownloadEquipmentAssignments = (
  alloc: EquipmentTypeAllocation,
  agreement: Agreement,
  query: GetLeaseAgreementsParams,
  result: AgreementRow[]
): void => {
  for (const assign of alloc.equipment_assignment) {
    const eq = assign.equipment_ref;

    // Only include rows matching unit_number if provided
    if (query.unit_number && !eq?.unit_number?.includes(query.unit_number)) {
      continue;
    }

    result.push(transformEquipmentAssignment(assign, alloc, agreement));
  }
};

/**
 * Processes download equipment type allocations
 */
const processDownloadEquipmentTypeAllocations = (
  line: LineItem,
  agreement: Agreement,
  query: GetLeaseAgreementsParams,
  result: AgreementRow[]
): void => {
  for (const alloc of line.equipment_type_allocation) {
    processDownloadEquipmentAssignments(alloc, agreement, query, result);
  }
};

/**
 * Flattens download data with reduced nesting
 */
const flattenDownloadData = (
  agreements: AgreementWithLineItems[],
  query: GetLeaseAgreementsParams
): AgreementRow[] => {
  const result: AgreementRow[] = [];

  for (const agreement of agreements) {
    for (const line of agreement.schedule_agreement_line_item) {
      processDownloadEquipmentTypeAllocations(line, agreement, query, result);
    }
  }

  return result;
};

/**
 * Applies equipment ID filtering for downloads
 */
const applyEquipmentIdFiltering = (
  transformedData: AgreementRow[],
  query: GetLeaseAgreementsParams
): AgreementRow[] => {
  const shouldDownloadAll = query.downloadAll;
  const hasEquipmentIds =
    Array.isArray(query.equipment_id) && query.equipment_id.length > 0;

  if (shouldDownloadAll || !hasEquipmentIds) {
    return transformedData;
  }

  const excluded = query.equipment_id?.map(Number) ?? [];
  return transformedData.filter(
    (row) =>
      typeof row.equipment_id === "number" &&
      !excluded.includes(row.equipment_id)
  );
};

/**
 * Calculates column width for Excel export
 */
const calculateColumnWidth = (field: string, maxWidth?: number): number => {
  if (maxWidth) return maxWidth;

  if (field === "sno") return EXCEL_CONSTANTS.SERIAL_NUMBER_WIDTH;

  const dateFields = ["start_date", "termination_date", "contract_created_at"];
  return dateFields.includes(field)
    ? EXCEL_CONSTANTS.DATE_COLUMN_WIDTH
    : EXCEL_CONSTANTS.DEFAULT_COLUMN_WIDTH;
};

/**
 * Formats Excel data rows
 */
const formatExcelRows = (
  transformedData: AgreementRow[],
  requestedColumns: RequestedColumn[]
): Record<AgreementRowKey, string | number | Date | null>[] => {
  return transformedData.map((row, index) => {
    const newRow: Record<AgreementRowKey, string | number | Date | null> =
      {} as Record<AgreementRowKey, string | number | null>;

    for (const { field } of requestedColumns) {
      switch (field) {
        case "sno":
          newRow[field] = index + 1;
          break;
        case "status":
          newRow[field] = row.status ?? null;
          break;
        case "start_date":
          newRow[field] = row.start_date ? formatDate(row.start_date) : null;
          break;
        case "termination_date":
          newRow[field] = row.termination_date
            ? formatDate(row.termination_date)
            : null;
          break;
        case "contract_created_at":
          newRow[field] = row.contract_created_at
            ? formatDate(row.contract_created_at)
            : null;
          break;
        default:
          newRow[field] = row[field as keyof AgreementRow] ?? null;
      }
    }

    return newRow;
  });
};

/**
 * Processes download sorting configuration
 */
const processDownloadSorting = (sort: string | undefined) => {
  const normalizedSort = normalizeSortForDownload(sort);
  const rawOrderBy = buildOrderByFromSort(
    normalizedSort,
    LEASE_AGREEMENT_SORT_FIELDS,
    "schedule_agreement_id"
  );

  const orderBy: Prisma.schedule_agreementOrderByWithRelationInput[] =
    rawOrderBy.filter((o: Record<string, unknown>) => {
      // Filter out in-memory sort fields that are not supported by Prisma
      return (
        !("_inMemoryAccountNumberSort" in o) &&
        !("_inMemoryAccountNameSort" in o) &&
        !("_inMemoryUnitNumberSort" in o) &&
        !("_inMemoryDescriptionSort" in o)
      );
    }) as Prisma.schedule_agreementOrderByWithRelationInput[];

  if (!orderBy || orderBy.length === 0) {
    orderBy.push({ schedule_agreement_id: "asc" });
  }

  return orderBy;
};

/**
 * Fetches agreements for download
 */
const fetchAgreementsForDownload = async (
  where: Prisma.schedule_agreementWhereInput,
  orderBy: Prisma.schedule_agreementOrderByWithRelationInput[]
) => {
  return await prisma.schedule_agreement.findMany({
    where,
    select: {
      schedule_agreement_id: true,
      schedule_agreement_ref: true,
      agreement_po: true,
      schedule_type: true,
      effective_date: true,
      termination_date: true,
      status: true,
      facility_lookup_ref: true,
      contract_type_lookup_ref: true,
      schedule_agreement_status_lookup: true,
      schedule_agreement_line_item: {
        include: {
          equipment_type_allocation: {
            include: {
              account: {
                select: {
                  account_id: true,
                  account_number: true,
                  account_name: true,
                },
              },
              equipment_assignment: { include: { equipment_ref: true } },
            },
          },
        },
      },
    },
    orderBy,
  });
};

/**
 * Processes data for download
 */
const processDownloadData = (
  agreements: AgreementWithLineItems[],
  query: GetLeaseAgreementsParams
) => {
  // Flatten data
  const transformedData = flattenDownloadData(agreements, query);

  // JS-side sorting for nested fields (like account_number)
  if (query.sort && query.account_number) {
    transformedData.sort((a, b) => {
      if (!a.account_number) return 1;
      if (!b.account_number) return -1;
      return query.account_number === "asc"
        ? a.account_number.localeCompare(b.account_number)
        : b.account_number.localeCompare(a.account_number);
    });
  }

  // Apply downloadAll / exclude equipment_ids
  return applyEquipmentIdFiltering(transformedData, query);
};

/**
 * Generates Excel file for download
 */
const generateExcelFile = (
  transformedData: AgreementRow[],
  requestedColumns: RequestedColumn[],
  filename: string
) => {
  // Prepare Excel columns
  const excelColumns = requestedColumns.map(({ label, field, maxWidth }) => ({
    header: label,
    key: field,
    width: calculateColumnWidth(field, maxWidth),
    formatter: (val: unknown) =>
      ["start_date", "termination_date", "contract_created_at"].includes(field)
        ? formatDate(val as Date | string | null | undefined)
        : val ?? "",
  }));

  // Format Excel rows
  const formattedData = formatExcelRows(transformedData, requestedColumns);

  // Generate workbook
  const exporter = new ExcelExporter();
  exporter.generateWorkbook({
    sheetName: "RentalAgreements",
    columns: excelColumns,
    data: formattedData,
    filename,
  });

  return exporter.writeToBuffer();
};

/**
 * Downloads rental agreements as an Excel file with custom column configuration
 * Handles data filtering, transformation, and Excel generation
 *
 * @param payload - Object containing query parameters and column configuration
 * @param payload.query - Filtering and pagination parameters
 * @param payload.columns - Excel column definitions with labels and formatting
 * @returns Promise containing Excel buffer and filename
 *
 * @throws {Error} When data processing fails or Excel generation fails
 *
 * @example
 * ```typescript
 * const result = await downloadRentalAgreementsService({
 *   query: { account_ids: [1, 2, 3], status: "active" },
 *   columns: [
 *     { label: "Unit Number", field: "unit_number", maxWidth: 20 },
 *     { label: "Account", field: "account_name", maxWidth: 30 }
 *   ]
 * });
 * ```
 */
export const downloadRentalAgreementsService = async (payload: {
  query: GetLeaseAgreementsParams;
  columns: RequestedColumn[];
}) => {
  const { query, columns: requestedColumns } = payload;

  // Handle account_ids
  const accountIdsArray = await handleAccountIdsForDownload(query);

  // Build Prisma where filter
  const where = buildDownloadWhereClause(query, accountIdsArray);

  // Process sorting
  const orderBy = processDownloadSorting(query.sort);

  // Fetch rental agreements
  const agreements = await fetchAgreementsForDownload(where, orderBy);

  // Process data
  const transformedData = processDownloadData(agreements, query);

  // Generate filename and Excel file
  const timestamp = new Date()
    .toISOString()
    .replaceAll(/[:.]/g, "-")
    .slice(0, -5);
  const filename = `rental_agreements_${timestamp}.xlsx`;
  const buffer = await generateExcelFile(
    transformedData,
    requestedColumns,
    filename
  );

  return { buffer, filename };
};

/**
 * Generates Excel file for lease download
 */
const generateLeaseExcelFile = (
  transformedData: AgreementRow[],
  requestedColumns: RequestedColumn[],
  filename: string
) => {
  // Prepare Excel columns
  const excelColumns = requestedColumns.map(({ label, field, maxWidth }) => ({
    header: label,
    key: field,
    width: calculateColumnWidth(field, maxWidth),
    formatter: (val: unknown) =>
      ["start_date", "termination_date", "contract_created_at"].includes(field)
        ? formatDate(val as Date | string | null | undefined)
        : val ?? "",
  }));

  // Format Excel rows
  const formattedData = formatExcelRows(transformedData, requestedColumns);

  // Generate workbook
  const exporter = new ExcelExporter();
  exporter.generateWorkbook({
    sheetName: "LeaseAgreements",
    columns: excelColumns,
    data: formattedData,
    filename,
  });

  return exporter.writeToBuffer();
};

/**
 * Downloads lease agreements as an Excel file with custom column configuration
 * Primary implementation for lease agreement downloads
 *
 * @param payload - Object containing query parameters and column configuration
 * @param payload.query - Filtering and pagination parameters
 * @param payload.columns - Excel column definitions with labels and formatting
 * @returns Promise containing Excel buffer and filename
 *
 * @throws {Error} When data processing fails or Excel generation fails
 *
 * @example
 * ```typescript
 * const result = await downloadLeaseAgreementsService({
 *   query: { account_ids: [1, 2, 3], contract_panel_type: "L" },
 *   columns: [
 *     { label: "Unit Number", field: "unit_number", maxWidth: 20 },
 *     { label: "Account", field: "account_name", maxWidth: 30 }
 *   ]
 * });
 * ```
 */
export const downloadLeaseAgreementsService = async (payload: {
  query: GetLeaseAgreementsParams;
  columns: RequestedColumn[];
}) => {
  const { query, columns: requestedColumns } = payload;

  // Handle account_ids
  const accountIdsArray = await handleAccountIdsForDownload(query);

  // Build Prisma where filter
  const where = buildDownloadWhereClause(query, accountIdsArray);

  // Process sorting
  const orderBy = processDownloadSorting(query.sort);

  // Fetch lease agreements
  const agreements = await fetchAgreementsForDownload(where, orderBy);

  // Process data
  const transformedData = processDownloadData(agreements, query);

  // Generate filename and Excel file
  const timestamp = new Date()
    .toISOString()
    .replaceAll(/[:.]/g, "-")
    .slice(0, -5);
  const filename = `lease_agreements_${timestamp}.xlsx`;
  const buffer = await generateLeaseExcelFile(
    transformedData,
    requestedColumns,
    filename
  );

  return { buffer, filename };
};
