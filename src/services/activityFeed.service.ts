import prisma from "../config/database.config";
import * as fs from "fs";
import ExcelJS from "exceljs";
import { getPagination, getPaginationMeta } from "../utils/pagination";
import { buildOrderByFromSort } from "../utils/sort";
import type { Prisma } from "@prisma/client";
import { ACTIVITY_FEED_SORT_FIELDS } from "../types/sorts/sortTypes";

// Constants
const MAX_DOWNLOAD_RECORDS = 1000000;

// Type aliases for union types
type DateOrString = string | Date;
type NumberOrString = number | string;

/**
 * Interface for activity feed query parameters
 * Defines structure for filtering and pagination parameters
 *
 * @author chaitanya
 */
interface ActivityFeedQuery {
  unit_number?: NumberOrString;
  equipment_type?: string;
  account_name?: string;
  account_number?: string;
  account?: string;
  customer?: string;
  geofence_name?: string;
  alert_name?: string;
  event_detail?: string;
  event_time_from?: DateOrString;
  event_time_to?: DateOrString;
  created_from?: DateOrString;
  created_to?: DateOrString;
  event_name?: string;
  // ...other fields as needed
  [key: string]: unknown;
}

/**
 * Creates a new activity feed entry
 * Inserts activity feed record with equipment, account, customer, and alert information
 *
 * @param data - Activity feed data object containing all required fields
 * @returns Created activity feed entry with related data
 * @author chaitanya
 */
export const createActivityFeedService = async (data: {
  equipment_id?: number;
  account_id?: number;
  customer_id: number;
  geofence_id?: number;
  telematic_alert_id?: number;
  alert_type_id?: number;
  alert_category_id?: number;
  latitude: number;
  longitude: number;
  event_time?: DateOrString;
  created_by?: number;
  updated_by?: number;
}) => {
  const now = new Date();

  return prisma.activity_feed.create({
    data: {
      equipment_id: data.equipment_id ?? null,
      account_id: data.account_id ?? null,
      customer_id: data.customer_id,
      geofence_id: data.geofence_id ?? null,
      telematic_alert_id: data.telematic_alert_id ?? null,
      alert_type_id: data.alert_type_id ?? null,
      alert_category_id: data.alert_category_id ?? null,
      latitude: data.latitude,
      longitude: data.longitude,
      event_time: data.event_time ? new Date(data.event_time) : now,
      is_deleted: false,
      created_at: now,
      created_by: data.created_by ?? null,
      updated_at: now,
      updated_by: data.updated_by ?? null,
    },
    include: getActivityFeedInclude(),
  });
};

/**
 * Builds equipment filter for activity feed query
 * @param query - Query parameters
 * @returns Equipment filter object
 */
const buildEquipmentFilter = (
  query: ActivityFeedQuery
): Record<string, unknown> => {
  const equipmentFilter: Record<string, unknown> = {};

  if (query.unit_number) {
    equipmentFilter.unit_number = {
      contains: query.unit_number,
      mode: "insensitive",
    };
  }

  if (query.equipment_type) {
    equipmentFilter.equipment_type_lookup_ref = {
      equipment_type: {
        contains: query.equipment_type,
        mode: "insensitive",
      },
    };
  }

  return equipmentFilter;
};

/**
 * Builds account filter for activity feed query
 * @param query - Query parameters
 * @returns Account filter object
 */
const buildAccountFilter = (
  query: ActivityFeedQuery
): Record<string, unknown> => {
  const accountFilter: Record<string, unknown> = {};

  if (query.account_name) {
    accountFilter.account_name = {
      contains: query.account_name,
      mode: "insensitive",
    };
  }

  if (query.account_number) {
    accountFilter.account_number = {
      contains: query.account_number,
      mode: "insensitive",
    };
  }

  if (query.account) {
    accountFilter.OR = [
      {
        account_name: { contains: query.account, mode: "insensitive" },
      },
      {
        account_number: {
          contains: query.account,
          mode: "insensitive",
        },
      },
    ];
  }

  return accountFilter;
};

/**
 * Helper function to create end date with time set to end of day
 * @param dateValue - Date value to process
 * @returns Date with time set to 23:59:59.999
 */
const createEndOfDayDate = (dateValue: DateOrString): Date => {
  const end = new Date(String(dateValue));
  end.setHours(23, 59, 59, 999);
  return end;
};

/**
 * Helper function to apply date range filter to a field
 * @param where - Where clause object
 * @param fieldName - Name of the field to filter
 * @param fromValue - Start date value
 * @param toValue - End date value
 */
const applyDateRangeFilter = (
  where: Prisma.activity_feedWhereInput,
  fieldName: "event_time" | "created_at",
  fromValue: DateOrString | undefined,
  toValue: DateOrString | undefined
): void => {
  if (!fromValue && !toValue) return;

  const dateFilter: { gte?: Date; lte?: Date } = {};

  if (fromValue) {
    dateFilter.gte = new Date(String(fromValue));
  }
  if (toValue) {
    dateFilter.lte = createEndOfDayDate(toValue);
  }

  where[fieldName] = dateFilter;
};

/**
 * Helper function to apply event time filters (both new and legacy)
 * @param where - Where clause object
 * @param query - Query parameters
 */
const applyEventTimeFilters = (
  where: Prisma.activity_feedWhereInput,
  query: ActivityFeedQuery
): void => {
  // New event time filters
  if (query.event_time_from || query.event_time_to) {
    applyDateRangeFilter(
      where,
      "event_time",
      query.event_time_from,
      query.event_time_to
    );
  }
  // Legacy event date filters
  else if (query.event_start_date || query.event_end_date) {
    applyDateRangeFilter(
      where,
      "event_time",
      query.event_start_date as DateOrString,
      query.event_end_date as DateOrString
    );
  }
};

/**
 * Applies date filters to where clause
 * @param where - Where clause object
 * @param query - Query parameters
 */
const applyDateFilters = (
  where: Prisma.activity_feedWhereInput,
  query: ActivityFeedQuery
): void => {
  // Apply event time filters
  applyEventTimeFilters(where, query);

  // Apply created date filters
  applyDateRangeFilter(
    where,
    "created_at",
    query.created_from,
    query.created_to
  );
};

/**
 * Builds the complete where clause for activity feed query
 * @param custId - Customer ID
 * @param query - Query parameters
 * @param userId - Optional user ID
 * @returns Complete where clause
 */
const buildWhereClause = (
  custId: number,
  query: ActivityFeedQuery,
  userId?: number
): Prisma.activity_feedWhereInput => {
  const where: Prisma.activity_feedWhereInput = {
    is_deleted: false,
    customer_id: custId,
  };

  if (userId) {
    where.created_by = userId;
  }

  // Direct ID filters
  if (query.activity_feed_id) {
    where.activity_feed_id = Number(query.activity_feed_id);
  }
  if (query.equipment_id) {
    where.equipment_id = Number(query.equipment_id);
  }
  if (query.account_id) {
    where.account_id = Number(query.account_id);
  }
  if (query.customer_id) {
    where.customer_id = Number(query.customer_id);
  }
  if (query.geofence_id) {
    where.geofence_id = Number(query.geofence_id);
  }
  if (query.alert_type_id) {
    where.alert_type_id = Number(query.alert_type_id);
  }
  if (query.telematic_alert_id) {
    where.telematic_alert_id = Number(query.telematic_alert_id);
  }

  // Equipment filter
  const equipmentFilter = buildEquipmentFilter(query);
  if (Object.keys(equipmentFilter).length > 0) {
    where.equipment = equipmentFilter;
  }

  // Account filter
  const accountFilter = buildAccountFilter(query);
  if (Object.keys(accountFilter).length > 0) {
    where.account = accountFilter;
  }

  // Customer filter
  if (query.customer) {
    where.customer = {
      customer_name: { contains: query.customer, mode: "insensitive" },
    };
  }

  // Geofence filter
  if (query.geofence_name) {
    where.geofence = {
      geofence_name: {
        contains: query.geofence_name,
        mode: "insensitive",
      },
    };
  }

  // Telematic alert filter
  if (query.alert_name) {
    where.telematic_alert = {
      alert_name: { contains: query.alert_name, mode: "insensitive" },
    };
  }

  // Event detail OR filter
  if (query.event_detail) {
    where.OR = [
      {
        geofence: {
          geofence_name: {
            contains: query.event_detail,
            mode: "insensitive",
          },
        },
      },
      {
        telematic_alert: {
          alert_name: {
            contains: query.event_detail,
            mode: "insensitive",
          },
        },
      },
    ];
  }

  // Event name filter
  if (query.event_name) {
    where.alert_type = {
      event_name: { contains: query.event_name, mode: "insensitive" },
    };
  }

  // Apply date filters
  applyDateFilters(where, query);

  return where;
};

/**
 * Common include clause for activity feed queries
 */
const getActivityFeedInclude = () => ({
  equipment: {
    select: {
      equipment_id: true,
      unit_number: true,
      equipment_type_lookup_ref: true,
    },
  },
  account: { select: { account_name: true, account_number: true } },
  customer: {
    select: {
      customer_name: true,
    },
  },
  geofence: {
    select: {
      geofence_name: true,
      description: true,
      geofence_location: true,
    },
  },
  alert_type: {
    select: { event_name: true },
  },
  telematic_alert: {
    select: {
      alert_name: true,
      alert_category: {
        select: { category_name: true },
      },
    },
  },
  created_by_user: {
    select: {
      user_id: true,
      first_name: true,
      last_name: true,
      email: true,
    },
  },
  updated_by_user: {
    select: {
      user_id: true,
      first_name: true,
      last_name: true,
      email: true,
    },
  },
});

/**
 * Fetches paginated activity feed for specific user
 * Retrieves activity feed entries with filtering, sorting, and pagination capabilities
 *
 * @param custId - Customer ID for filtering
 * @param page - Page number for pagination
 * @param perPage - Number of items per page
 * @param query - Query parameters for filtering and sorting
 * @param userId - Optional user ID for additional filtering
 * @returns Paginated activity feed data with metadata
 * @author chaitanya
 */
export const getActivityFeedByUserService = async (
  custId: number,
  page: number,
  perPage: number,
  query: ActivityFeedQuery,
  userId?: number
) => {
  const { skip, take } = getPagination({ page, perPage });
  const where = buildWhereClause(custId, query, userId);
  const orderBy = buildOrderByFromSort(
    typeof query.sort === "string" ? query.sort : undefined,
    ACTIVITY_FEED_SORT_FIELDS,
    "event_time"
  );

  const feeds = await prisma.activity_feed.findMany({
    where,
    skip,
    take,
    orderBy,
    include: getActivityFeedInclude(),
  });

  const total = await prisma.activity_feed.count({ where });
  const meta = getPaginationMeta(total, page, perPage);

  return { feeds, meta };
};

/**
 * Filters feeds based on download criteria
 * @param feeds - Array of activity feeds
 * @param downloadIds - Array of IDs to include/exclude
 * @param downloadAll - Whether to download all or filter by IDs
 * @returns Filtered array of feeds
 */
const filterFeedsForDownload = (
  feeds: unknown[],
  downloadIds: unknown[] | null | undefined,
  downloadAll: boolean
): unknown[] => {
  if (!Array.isArray(downloadIds)) {
    return feeds;
  }

  const idsSet = new Set(downloadIds);
  return downloadAll
    ? feeds.filter((f: any) => !idsSet.has(f.activity_feed_id))
    : feeds.filter((f: any) => idsSet.has(f.activity_feed_id));
};

/**
 * Creates column definitions for Excel export
 * @param columns - Column configuration from request body
 * @returns Array of column definitions
 */
const createExcelColumns = (
  columns: { label: string; field: string; width?: number }[]
) => {
  return [
    { header: "S.No", key: "sno", width: 8 },
    ...columns.map((col) => ({
      header: col.label,
      key: col.field,
      width: col.width ?? 25,
    })),
  ];
};

/**
 * Formats date for display
 * @param date - Date to format
 * @returns Formatted date string or "N/A"
 */
const formatDate = (date: string | number | Date): string => {
  return date
    ? new Date(date).toLocaleString("en-GB", { hour12: true })
    : "N/A";
};

/**
 * Gets field value for a specific column
 * @param feed - Activity feed object
 * @param field - Field name to extract
 * @param formatter - Optional formatter function
 * @returns Formatted field value
 */
const getFieldValue = (
  feed: any,
  field: string,
  formatter?: FormatterFunction
): unknown => {
  switch (field) {
    case "event_detail":
      return feed?.telematic_alert?.alert_name || feed?.geofence?.geofence_name
        ? `${feed?.telematic_alert?.alert_name ?? ""} (${
            feed?.geofence?.geofence_name ?? ""
          })`
        : "N/A";
    case "unit_number":
      return feed?.equipment?.unit_number ?? "N/A";
    case "equipment_type":
      return (
        feed?.equipment?.equipment_type_lookup_ref?.equipment_type ?? "N/A"
      );
    case "date_time":
      return formatDate(feed?.event_time);
    case "account":
      return feed?.account?.account_name ?? "N/A";
    case "account_number":
      return feed?.account?.account_number ?? "N/A";
    case "account_name":
      return feed?.account?.account_name ?? "N/A";
    case "event_type":
      return feed?.alert_type?.event_name ?? "N/A";
    default:
      return typeof formatter === "function"
        ? formatter(feed[field as keyof typeof feed], feed)
        : feed[field as keyof typeof feed] ?? "N/A";
  }
};

/**
 * Formats data for Excel export
 * @param feeds - Array of activity feeds
 * @param columns - Column configuration
 * @returns Formatted data array
 */
const formatDataForExcel = (
  feeds: unknown[],
  columns: { field: string; formatter?: FormatterFunction }[]
): Record<string, unknown>[] => {
  return feeds.map((feed: any, idx: number) => {
    const row: Record<string, unknown> = { sno: idx + 1 };

    for (const col of columns) {
      row[col.field] = getFieldValue(feed, col.field, col.formatter);
    }

    return row;
  });
};

/**
 * Adjusts column widths based on content
 * @param worksheet - Excel worksheet
 */
const adjustColumnWidths = (worksheet: ExcelJS.Worksheet): void => {
  if (worksheet.rowCount === 0) return;

  worksheet.columns.forEach((col, colIdx) => {
    let maxLength = 10;
    worksheet.eachRow((row) => {
      const cell = row.getCell(colIdx + 1);
      let val = "";
      if (cell.value !== undefined && cell.value !== null) {
        if (typeof cell.value === "object") {
          val = JSON.stringify(cell.value);
        } else {
          val = cell.value.toString();
        }
      }
      if (val.length > maxLength) maxLength = val.length;
    });
    col.width = maxLength + 2;
  });
};

/**
 * Creates Excel workbook and worksheet
 * @param columns - Column definitions
 * @param data - Formatted data
 * @returns Excel workbook
 */
const createExcelWorkbook = (
  columns: { header: string; key: string; width: number }[],
  data: Record<string, unknown>[]
): ExcelJS.Workbook => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Activity Feed");
  worksheet.columns = columns;
  worksheet.addRows(data);
  adjustColumnWidths(worksheet);
  return workbook;
};

/**
 * Saves file locally if in LOCAL environment
 * @param filename - Name of the file
 * @param buffer - File buffer
 */
const saveFileLocally = (filename: string, buffer: Buffer): void => {
  // eslint-disable-next-line n/no-process-env
  if (process.env.ENVIRONMENT === "LOCAL") {
    if (!fs.existsSync("activity_feed")) {
      fs.mkdirSync("activity_feed");
    }
    fs.writeFileSync(`activity_feed/${filename}`, buffer);
  }
};

/**
 * Generates Excel download for user's activity feed
 * Creates Excel file with selected columns and filtering options for activity feed data
 *
 * @param custId - Customer ID for filtering
 * @param query - Query parameters for filtering
 * @param body - Request body containing column selection and download options
 * @param userId - Optional user ID for additional filtering
 * @returns Excel file buffer and filename
 * @author chaitanya
 */
export const downloadActivityFeedByUserService = async (
  custId: number,
  query: Record<string, unknown>,
  body: DownloadActivityFeedBody,
  userId?: number
) => {
  const { feeds } = await getActivityFeedByUserService(
    custId,
    1,
    MAX_DOWNLOAD_RECORDS,
    {
      ...query,
      ...body.query,
    },
    userId
  );

  if (!feeds.length) throw new Error("NO_FEEDS_FOUND");

  const filteredFeeds = filterFeedsForDownload(
    feeds,
    body.query.download_ids,
    body.query.downloadAll
  );

  const columns = createExcelColumns(body.columns);
  const formattedData = formatDataForExcel(filteredFeeds, body.columns);
  const workbook = createExcelWorkbook(columns, formattedData);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const filename = `customer_${custId}_activity_feed_${timestamp}.xlsx`;

  const bufferArray = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(bufferArray);
  saveFileLocally(filename, buffer);

  return { buffer, filename };
};

/**
 * Interface for download activity feed request body
 * Defines structure for column selection and download filtering options
 *
 * @author chaitanya
 */
type DownloadIds = unknown[] | null | undefined;
type FormatterFunction = (value: unknown, feed: unknown) => unknown;

interface DownloadActivityFeedBody {
  query: {
    download_ids: DownloadIds;
    downloadAll: boolean;
  };
  columns: {
    label: string;
    field: string;
    width?: number;
    formatter?: FormatterFunction;
  }[];
}
