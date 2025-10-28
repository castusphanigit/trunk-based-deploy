import prisma from "../config/database.config";
import ExcelJS from "exceljs";
import * as fs from "fs";
import {
  DownloadGeofenceRequestDto,
  GetGeofenceByUserIdQuery,
  AccountDto,
} from "../types/dtos/geofence-request.dto";
import { GeofenceAccountResponseDto } from "../types/dtos/geofence-response.dto";
import { getPagination } from "../utils/pagination";

import { formatters } from "../utils/excelUtils";

import { buildOrderByFromSort } from "../utils/sort";
import { GEOFENCE_SORT_FIELDS } from "../types/sorts/sortTypes";

// Local type representing the rows returned by Prisma for geofence findMany/select
// Keep properties optional to match select behavior
interface GeofenceRow {
  geofence_id: number;
  geofence_name?: string | null;
  assets_in_geofence?: number | null;
  zoom_level?: number | null;
  shape_type?: string | null;
  center_lat?: number | null;
  center_lng?: number | null;
  radius_meters?: number | null;
  owner?: string | null;
  description?: string | null;
  geofence_location?: string | null;
  status?: string | null;
  created_by?: number | null;
  created_at?: Date | null;
  updated_by?: number | null;
  updated_at?: Date | null;
  tag_lookup?: { tag_name?: string | null } | null;
  account_ids?: unknown;
  created_by_user?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
  updated_by_user?: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | null;
}

// Helper functions to reduce cognitive complexity
const buildBaseWhereClause = (
  custId: number,
  userId?: string | number
): Record<string, unknown> => {
  const where: Record<string, unknown> = {
    customer_id: custId,
    is_deleted: false,
  };

  if (userId != null && !isNaN(Number(userId))) {
    where.created_by = Number(userId);
  }

  return where;
};

const addBasicFilters = (
  where: Record<string, unknown>,
  query: GetGeofenceByUserIdQuery
): void => {
  if (query.geofence_name) {
    where.geofence_name = {
      contains: query.geofence_name,
      mode: "insensitive",
    };
  }
  if (query.description) {
    where.description = { contains: query.description, mode: "insensitive" };
  }
  if (query.geofence_location) {
    where.geofence_location = {
      contains: query.geofence_location,
      mode: "insensitive",
    };
  }
  if (query.geofence_shape) {
    where.shape_type = { equals: query.geofence_shape };
  }
  if (query.owner) {
    where.owner = { contains: query.owner, mode: "insensitive" };
  }
  if (query.status) {
    where.status = { equals: query.status };
  }
  if (query.tag_name) {
    where.tag_lookup = {
      tag_name: { contains: query.tag_name, mode: "insensitive" },
    };
  }
  if (
    query.assets_in_geofence !== undefined &&
    query.assets_in_geofence !== null
  ) {
    where.assets_in_geofence = query.assets_in_geofence;
  }
};

const addUserFilters = (
  where: Record<string, unknown>,
  query: GetGeofenceByUserIdQuery
): void => {
  if (query.created_by) {
    where.created_by_user = {
      OR: [
        { first_name: { contains: query.created_by, mode: "insensitive" } },
        { last_name: { contains: query.created_by, mode: "insensitive" } },
      ],
    };
  }
  if (query.updated_by) {
    where.updated_by_user = {
      OR: [
        { first_name: { contains: query.updated_by, mode: "insensitive" } },
        { last_name: { contains: query.updated_by, mode: "insensitive" } },
      ],
    };
  }
};

const addDateFilters = (
  where: Record<string, unknown>,
  query: GetGeofenceByUserIdQuery
): void => {
  if (query.created_from || query.created_to) {
    const createdAt: Record<string, Date> = {};
    if (query.created_from) {
      createdAt.gte = new Date(query.created_from);
    }
    if (query.created_to) {
      const end = new Date(query.created_to);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    where.created_at = createdAt;
  }

  if (query.updated_from || query.updated_to) {
    const updatedAt: Record<string, Date> = {};
    if (query.updated_from) {
      updatedAt.gte = new Date(query.updated_from);
    }
    if (query.updated_to) {
      const end = new Date(query.updated_to);
      end.setHours(23, 59, 59, 999);
      updatedAt.lte = end;
    }
    where.updated_at = updatedAt;
  }
};

const processAccountData = async (
  geofences: GeofenceRow[]
): Promise<Record<number, AccountDto>> => {
  const allAccountIds = Array.from(
    new Set(
      geofences.flatMap((g: GeofenceRow) =>
        Array.isArray(g.account_ids)
          ? (g.account_ids as (number | null)[])
              .filter((id): id is number => typeof id === "number")
              .map(Number)
          : []
      )
    )
  );

  const accounts = await prisma.account.findMany({
    where: { account_id: { in: allAccountIds }, is_deleted: false },
    select: { account_id: true, account_name: true, account_number: true },
  });

  return accounts.reduce((acc: Record<number, AccountDto>, a: AccountDto) => {
    acc[a.account_id] = a;
    return acc;
  }, {});
};

const mapAccountIds = (
  accountIds: unknown,
  accountsById: Record<number, AccountDto>
): {
  account_id: number;
  account_name?: string | null;
  account_number?: string | null;
}[] => {
  if (!Array.isArray(accountIds)) {
    return [];
  }

  return (accountIds as (number | null)[]).reduce<
    {
      account_id: number;
      account_name?: string | null;
      account_number?: string | null;
    }[]
  >((accArr, id) => {
    if (typeof id === "number") {
      const acc = accountsById[id];
      if (acc) {
        accArr.push({
          account_id: acc.account_id,
          account_name: acc.account_name ?? "",
          account_number: acc.account_number ?? "",
        });
      }
    }
    return accArr;
  }, []);
};

// Helper function to safely get string values with fallback
const getStringValue = (
  value: string | null | undefined,
  fallback = ""
): string => {
  return value ?? fallback;
};

// Helper function to safely get nullable values
const getNullableValue = <T>(value: T | null | undefined): T | null => {
  return value ?? null;
};

// Helper function to safely get tag name
const getTagName = (
  tagLookup: { tag_name?: string | null } | null | undefined
): string | null => {
  return tagLookup?.tag_name ?? null;
};

const mapSingleGeofence = (
  g: GeofenceRow,
  accountsById: Record<number, AccountDto>
): GeofenceAccountResponseDto => ({
  id: g.geofence_id,
  geofence_name: getStringValue(g.geofence_name),
  assets_in_geofence: getNullableValue(g.assets_in_geofence),
  zoom_level: getNullableValue(g.zoom_level),
  geofence_shape: getStringValue(g.shape_type),
  center_lat: getNullableValue(g.center_lat),
  center_lng: getNullableValue(g.center_lng),
  radius_meters: getNullableValue(g.radius_meters),
  owner: getNullableValue(g.owner),
  description: getNullableValue(g.description),
  geofence_location: getNullableValue(g.geofence_location),
  status: getNullableValue(g.status),
  created_by: getNullableValue(g.created_by),
  created_by_user: getNullableValue(g.created_by_user),
  updated_by: getNullableValue(g.updated_by),
  updated_by_user: getNullableValue(g.updated_by_user),
  tag_name: getTagName(g.tag_lookup),
  accounts: mapAccountIds(g.account_ids, accountsById),
  created_at: getNullableValue(g.created_at),
  updated_at: getNullableValue(g.updated_at),
});

const mapGeofenceData = (
  geofences: GeofenceRow[],
  accountsById: Record<number, AccountDto>
): GeofenceAccountResponseDto[] => {
  return geofences.map((g: GeofenceRow) => mapSingleGeofence(g, accountsById));
};

export class GeofenceService {
  /**
   * Validates download request parameters
   */
  private validateDownloadRequest(
    body: DownloadGeofenceRequestDto,
    custId: number
  ): void {
    if (
      !body.columns ||
      !Array.isArray(body.columns) ||
      body.columns.length === 0
    ) {
      throw new Error("Columns are required for export");
    }
    if (!body.query) {
      throw new Error("Query parameters missing");
    }
    if (!custId || isNaN(custId)) {
      throw new Error("Valid customer ID is required");
    }
  }

  /**
   * Filters geofence data based on download criteria
   */
  private filterGeofenceData(
    data: GeofenceAccountResponseDto[],
    downloadAll: boolean,
    downloadIds?: number[]
  ): GeofenceAccountResponseDto[] {
    if (!Array.isArray(downloadIds)) {
      return data;
    }

    const idsSet = new Set(downloadIds);
    if (downloadAll) {
      return data.filter((item) => !idsSet.has(item.id));
    } else {
      return data.filter((item) => idsSet.has(item.id));
    }
  }

  /**
   * Formats geofence data for Excel export
   */
  private formatGeofenceDataForExport(
    filteredData: GeofenceAccountResponseDto[],
    columns: { field: string; label: string; width?: number }[]
  ): Record<string, unknown>[] {
    const formatUserName = (
      user:
        | { first_name?: string | null; last_name?: string | null }
        | null
        | undefined
    ) =>
      user ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() : "N/A";

    return filteredData.map((g, index) => {
      const row: Record<string, unknown> = {
        sno: formatters.serialNumber(index, 0),
      };

      for (const col of columns) {
        switch (col.field) {
          case "geofence_name":
            row.geofence_name = g.geofence_name ?? "N/A";
            break;
          case "geofence_location":
            row.geofence_location = g.geofence_location ?? "N/A";
            break;
          case "assets_in_geofence":
            row.assets_in_geofence = g.assets_in_geofence ?? "N/A";
            break;
          case "accounts":
            if (Array.isArray(g.accounts) && g.accounts.length > 0) {
              row.accounts = g.accounts
                .map((acc) => acc.account_number)
                .join(", ");
            } else {
              row.accounts = "N/A";
            }
            break;
          case "created_at":
          case "created_date":
            row.created_at = g.created_at;
            break;
          case "created_by_user":
          case "created_by":
            row.created_by_user = formatUserName(g.created_by_user);
            break;
          case "updated_at":
          case "last_modified_date":
            row.updated_at = g.updated_at;
            break;
          case "updated_by_user":
          case "last_modified_by":
            row.updated_by_user = formatUserName(g.updated_by_user);
            break;
          case "description":
            row.description = g.description ?? "N/A";
            break;
          default:
            row[col.field] = null;
        }
      }

      return row;
    });
  }

  /**
   * Creates Excel workbook with formatted data
   */
  private async createExcelWorkbook(
    formattedData: Record<string, unknown>[],
    columns: { field: string; label: string; width?: number }[]
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("User Geofences");

    const excelColumns = [
      {
        header: "S.No",
        key: "sno",
        width: 8,
      },
      ...columns.map((col) => ({
        header: col.label,
        key: col.field,
        width: col.width ?? 25,
      })),
    ];

    worksheet.columns = excelColumns;
    worksheet.addRows(formattedData);

    // Auto-fit column widths
    worksheet.columns?.forEach((column) => {
      let maxLength = 10;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        let cellValue: string;
        if (cell.value != null) {
          if (typeof cell.value === "object" && cell.value !== null) {
            cellValue = Array.isArray(cell.value)
              ? cell.value.join(", ")
              : JSON.stringify(cell.value);
          } else {
            cellValue = String(cell.value);
          }
        } else {
          cellValue = "";
        }
        if (cellValue.length > maxLength) {
          maxLength = cellValue.length;
        }
      });
      column.width = maxLength + 2;
    });

    const bufferArray = await workbook.xlsx.writeBuffer();
    return Buffer.from(bufferArray as ArrayBuffer);
  }

  public async getGeofencesByCustomer(
    params: { custId: string | number; userId?: string | number },
    query: GetGeofenceByUserIdQuery
  ): Promise<{
    data: GeofenceAccountResponseDto[];
    total: number;
    page: number;
    perPage: number;
  }> {
    const { custId, userId } = params;
    const { page, perPage, skip, take } = getPagination(query);

    if (custId == null || isNaN(Number(custId))) {
      throw new Error("Valid customer ID (custId) is required");
    }

    const where = buildBaseWhereClause(Number(custId), userId);
    addBasicFilters(where, query);
    addUserFilters(where, query);
    addDateFilters(where, query);

    //  Count total
    const total = await prisma.geofence.count({ where });

    //  Sorting (fallback to created_at if nothing passed)
    const orderBy = buildOrderByFromSort(
      query.sort,
      GEOFENCE_SORT_FIELDS,
      "created_at"
    );

    //  Fetch data
    const geofences = await prisma.geofence.findMany({
      where,
      select: {
        geofence_id: true,
        geofence_name: true,
        assets_in_geofence: true,
        shape_type: true,
        center_lat: true,
        center_lng: true,
        radius_meters: true,
        owner: true,
        description: true,
        geofence_location: true,
        status: true,
        created_by: true,
        created_at: true,
        updated_by: true,
        updated_at: true,
        zoom_level: true,
        tag_lookup: { select: { tag_name: true } },
        created_by_user: {
          select: { first_name: true, last_name: true, email: true },
        },
        updated_by_user: {
          select: { first_name: true, last_name: true, email: true },
        },
        account_ids: true,
      },
      skip,
      take,
      orderBy,
    });

    if (!geofences.length) {
      return { data: [], total, page, perPage };
    }

    const accountsById = await processAccountData(geofences);
    const result = mapGeofenceData(geofences, accountsById);

    return { data: result, total, page, perPage };
  }

  public async downloadGeofenceByUserId(
    params: { custId: string | number; userId?: string | number },
    query: GetGeofenceByUserIdQuery,
    body: DownloadGeofenceRequestDto
  ): Promise<{ buffer: Buffer; filename: string }> {
    const custId = Number(params.custId);
    this.validateDownloadRequest(body, custId);

    const { downloadAll, download_ids } = body.query;

    // Fetch all data for export
    const { data } = await this.getGeofencesByCustomer(params, {
      ...query,
      page: 1,
      perPage: 100000,
    });

    if (!data.length) {
      throw new Error("NO_GEOFENCES_FOUND");
    }

    // Filter data based on download criteria
    const filteredData = this.filterGeofenceData(
      data,
      downloadAll,
      download_ids
    );

    // Format data for Excel
    const formattedData = this.formatGeofenceDataForExport(
      filteredData,
      body.columns
    );

    // Create Excel workbook
    const buffer = await this.createExcelWorkbook(formattedData, body.columns);

    // Generate filename
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, -5);
    const filename = `customer_${custId}_geofences_${timestamp}.xlsx`;

    // Save to local file if in LOCAL environment
    const environment = process.env.ENVIRONMENT ?? "production";
    if (environment === "LOCAL") {
      try {
        fs.writeFileSync(
          `geofence_exports/${timestamp}_geofences.xlsx`,
          buffer
        );
      } catch {
        // ignore write failures in non-local environments
      }
    }

    return { buffer, filename };
  }

  public async toggleGeofenceStatus(
    geofenceAccountId: number
  ): Promise<string> {
    // Fetch current status avoiding geometry issues
    const geofence = await prisma.geofence.findUnique({
      where: { geofence_id: geofenceAccountId },
      select: { status: true },
    });

    if (!geofence) {
      throw new Error("Geofence not found");
    }

    const newStatus = geofence.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

    await prisma.geofence.update({
      where: { geofence_id: geofenceAccountId },
      data: { status: newStatus },
      select: { status: true },
    });

    return newStatus;
  }
  /**
   * Extracts account IDs from geofence data
   */
  private extractAccountIds(accounts: { account_ids: unknown }[]): number[] {
    const accountIdSet = new Set<number>();

    for (const account of accounts) {
      let parsed: unknown = account.account_ids;

      if (typeof parsed === "string") {
        try {
          parsed = JSON.parse(parsed);
        } catch {
          continue; // malformed JSON skip
        }
      }

      if (Array.isArray(parsed)) {
        parsed.forEach((id) => {
          if (typeof id === "number") accountIdSet.add(id);
        });
      } else if (typeof parsed === "number") {
        accountIdSet.add(parsed);
      }
    }

    return Array.from(accountIdSet);
  }

  /**
   * Gets equipment IDs for given account IDs
   */
  private async getEquipmentIds(accountIds: number[]): Promise<number[]> {
    if (!accountIds.length) {
      return [];
    }

    const equipmentTypeAllocations =
      await prisma.equipment_type_allocation.findMany({
        where: { account_id: { in: accountIds } },
        select: { equipment_assignment: { select: { equipment_id: true } } },
      });

    const equipmentIdSet = new Set<number>();
    equipmentTypeAllocations.forEach((allocation) => {
      allocation.equipment_assignment.forEach((assignment) => {
        equipmentIdSet.add(assignment.equipment_id);
      });
    });

    return Array.from(equipmentIdSet);
  }

  public async getGeofenceCountsByCustomer(custId: number, userId?: number) {
    if (isNaN(custId)) {
      throw new Error("Invalid customer ID");
    }

    // Build where clause for customer and optional user
    const whereClause: Record<string, unknown> = {
      customer_id: custId,
      is_deleted: false,
    };

    if (userId !== undefined) {
      whereClause.created_by = userId;
    }

    // Count geofences
    const [AllGeoFences, geoFenceActive, geoFenceInActive] = await Promise.all([
      prisma.geofence.count({ where: whereClause }),
      prisma.geofence.count({ where: { ...whereClause, status: "ACTIVE" } }),
      prisma.geofence.count({
        where: { ...whereClause, status: { not: "ACTIVE" } },
      }),
    ]);

    // Get account IDs from geofences
    const accounts = await prisma.geofence.findMany({
      where: whereClause,
      select: { account_ids: true },
    });

    const accountIdsArray = this.extractAccountIds(accounts);
    if (!accountIdsArray.length) {
      return {
        geoFenceActive: 0,
        geoFenceInActive: 0,
        AllGeoFences: 0,
        criticalBatteryCount: 0,
      };
    }

    // Get equipment IDs and count critical battery devices
    const equipmentIdsArray = await this.getEquipmentIds(accountIdsArray);
    let criticalBatteryCount = 0;
    if (equipmentIdsArray.length > 0) {
      criticalBatteryCount = await prisma.iot_device.count({
        where: {
          battery_health: "critical",
          equipment_iot_device_ref: {
            equipment_id: { in: equipmentIdsArray },
          },
        },
      });
    }

    return {
      geoFenceActive,
      geoFenceInActive,
      AllGeoFences,
      criticalBatteryCount,
    };
  }
}
