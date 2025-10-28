import prisma from "../config/database.config";
import * as fs from "fs";
import axios from "axios";
import logger from "../utils/logger";

import ExcelJS from "exceljs";

import {
  CreateTelematicsAlertDto,
  FetchUsersByAccountsDto,
  FetchEquipmentByAccountsDto,
  FetchEquipmentByAccountsEventsDto,
} from "../types/dtos/telematicsAlert-request.dto";
import {
  getPagination,
  getPaginationMeta,
  PaginationMeta,
  PaginationParams,
} from "../utils/pagination";
import { buildOrderByFromSort } from "../utils/sort";

import { TELEMATICS_ALERT_SORT_FIELDS } from "../types/sorts/sortTypes";
import {
  EquipmentResponseDto,
  UserResponseDto,
} from "src/types/dtos/telematicsAlert-response.dto";

interface ColumnDefinition {
  label: string;
  field: string;
  formatter?: (val: unknown, alert?: Record<string, unknown>) => unknown;
  width?: number;
}

interface DownloadQuery {
  downloadAll: boolean;
  download_ids?: number[];
  [key: string]: unknown;
}

export interface DownloadRequestBody {
  columns: ColumnDefinition[];
  query: DownloadQuery;
}

export interface WebhookPayload {
  customer_id: number;
  created_by: number;
  latitude?: number;
  longitude?: number;
  equipment_id?: number;
  account_id?: number;
  geofence_id?: number;
  telematic_alert_id: number;
  alert_type_id?: number;
  alert_category_id?: number;
  event_time: string;
}

export interface WebhookResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  response?: unknown;
}

// Webhook service method
export const callWebhookService = async (
  customerId: number,
  alertData: unknown,
  webhookPayload: WebhookPayload
): Promise<WebhookResponse> => {
  try {
    // Fetch customer webhook details
    const customer = await prisma.customer.findUnique({
      where: { customer_id: customerId },
      select: {
        web_hook_url: true,
        web_hook_password: true,
        web_hook_userName: true,
      },
    });

    if (!customer?.web_hook_url) {
      return {
        success: false,
        error: "Customer webhook URL not configured",
      };
    }

    // Prepare authentication headers
    const authHeaders: Record<string, string> = {};
    if (customer.web_hook_userName && customer.web_hook_password) {
      const credentials = Buffer.from(
        `${customer.web_hook_userName}:${customer.web_hook_password}`
      ).toString("base64");
      authHeaders.Authorization = `Basic ${credentials}`;
    }

    // Make POST request to external webhook
    const response = await axios.post(customer.web_hook_url, webhookPayload, {
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      timeout: 30000, // 30 second timeout
    });

    return {
      success: true,
      data: response.data as unknown,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      },
    };
  } catch (error) {
    // Log error for debugging
    logger.error((error as Error).message || "Webhook call failed", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown webhook error",
    };
  }
};

// Helper function to process equipment selection
const processEquipmentSelection = async (
  dto: CreateTelematicsAlertDto
): Promise<number[]> => {
  const result =
    await EquipmentService.fetchEquipmentByAccountsOrCustIdAndEvents(
      {
        account_ids: dto.account_id ?? [],
        customer_id: dto.customer_id,
        event_cat_id: dto.events_category_id,
      },
      { page: 1, perPage: Number.MAX_SAFE_INTEGER }
    );

  const equipmentIds: number[] = result.equipment
    .map((e: EquipmentResponseDto) => e.equipment_id)
    .filter((id: number) => !isNaN(id));

  const equipmentSelectAll = dto.equipmentSelectAll;
  let equipmentIdList: number[] = [];

  if (equipmentSelectAll && dto.equipment_ids?.length) {
    equipmentIdList = equipmentIds.filter(
      (id) => !(dto.equipment_ids ?? []).includes(id)
    );
  } else if (!equipmentSelectAll && dto.equipment_ids?.length) {
    equipmentIdList = [...dto.equipment_ids];
  } else {
    equipmentIdList = equipmentSelectAll ? equipmentIds : [];
  }

  return equipmentIdList;
};

// Helper function to create webhook payload
const createWebhookPayload = (
  dto: CreateTelematicsAlertDto,
  alertId: number,
  equipmentIdList: number[]
): WebhookPayload => {
  const now = new Date();
  return {
    customer_id: dto.customer_id,
    created_by: dto.created_by ?? 0,
    latitude: 40.7128,
    longitude: -74.006,
    equipment_id: equipmentIdList.length > 0 ? equipmentIdList[0] : undefined,
    account_id: dto.account_id?.length ? dto.account_id[0] : undefined,
    geofence_id: dto.geofence_account_id?.length
      ? dto.geofence_account_id[0]
      : undefined,
    telematic_alert_id: alertId,
    alert_type_id: dto.events_id?.length ? dto.events_id[0] : undefined,
    alert_category_id: dto.events_category_id,
    event_time: now.toISOString(),
  };
};

// Helper functions to build specific sections of alert data
const buildBasicAlertFields = (dto: CreateTelematicsAlertDto) => ({
  alert_name: dto.geofence_alert_name ?? null,
  status: dto.status,
});

// Helper function to convert temperature to Fahrenheit
const convertToFahrenheit = (value: string, unitId: number): number => {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return 0;

  // 1 = Fahrenheit (no conversion)
  // 2 = Celsius
  // 3 = Celsius (both 2 and 3 are Celsius)
  if (unitId === 1) return numValue;
  if (unitId === 2 || unitId === 3) return (numValue * 9) / 5 + 32; // Celsius to Fahrenheit
  return numValue;
};

// Helper function to build temperature conversion values
const buildTemperatureConversion = (
  dto: CreateTelematicsAlertDto
): number[] => {
  const convertedValues: number[] = [];
  const isTemperatureAlert =
    dto.events_id?.includes(6) && dto.temperature_unit_id;

  if (isTemperatureAlert && dto.temperature_unit_id) {
    if (dto.event_low) {
      convertedValues.push(
        convertToFahrenheit(dto.event_low, dto.temperature_unit_id)
      );
    }
    if (dto.event_high) {
      convertedValues.push(
        convertToFahrenheit(dto.event_high, dto.temperature_unit_id)
      );
    }
  }

  return convertedValues;
};

const buildTemperatureFields = (dto: CreateTelematicsAlertDto) => ({
  event_low: dto.event_low ?? null,
  event_high: dto.event_high ?? null,
  converted_type: dto.events_id?.includes(6) ? "F" : null,
  converted_value: buildTemperatureConversion(dto),
  temperature_unit_id: dto.temperature_unit_id ?? null,
});

const buildAlertTypeFields = (dto: CreateTelematicsAlertDto) => ({
  account_id: dto.account_id ?? [],
  geofence_id: dto.geofence_account_id ?? [],
  alert_type_id: dto.events_id ?? [],
  alert_category_id: dto.events_category_id ?? null,
});

const buildTimeFields = (dto: CreateTelematicsAlertDto, now: Date) => ({
  between_hours_from: dto.between_hours_from ?? null,
  between_hours_to: dto.between_hours_to ?? null,
  specific_days: dto.specific_days ?? [],
  start_date: dto.start_date ? new Date(dto.start_date) : null,
  end_date: dto.end_date ? new Date(dto.end_date) : null,
  event_duration: dto.event_duration ?? null,
  created_at: now,
  updated_at: now,
});

const buildRecipientFields = (dto: CreateTelematicsAlertDto) => ({
  delivery_methods: dto.delivery_methods ?? [],
  textRecipientsObj: dto.textRecipientsObj ?? [],
  emailRecipientsObj: dto.emailRecipientsObj ?? [],
  recipients: dto.recipients ?? [],
  recipients_email: dto.recipients_email ?? [],
  recipients_mobile: dto.recipients_mobile ?? [],
  recipients_user_ids: dto.recipients_user_ids ?? [],
});

const buildEquipmentFields = (
  dto: CreateTelematicsAlertDto,
  equipmentIdList: number[]
) => ({
  equipment_ids: equipmentIdList ?? [],
  selected_equipment_ids: dto.equipment_ids ?? [],
  equipmentSelectAll: dto.equipmentSelectAll ?? false,
});

const buildSystemFields = (dto: CreateTelematicsAlertDto, now: Date) => ({
  is_deleted: false,
  deleted_by: dto.deleted_by ?? null,
  deleted_at: now,
  created_by: dto.created_by ?? null,
  updated_by: dto.updated_by ?? null,
  customer_id: dto.customer_id ?? null,
  webhook: dto.webhook ?? false,
});

// Helper function to build alert data for create/update operations
const buildAlertData = (
  dto: CreateTelematicsAlertDto,
  equipmentIdList: number[],
  now: Date
) => ({
  ...buildBasicAlertFields(dto),
  ...buildTemperatureFields(dto),
  ...buildAlertTypeFields(dto),
  ...buildTimeFields(dto, now),
  ...buildRecipientFields(dto),
  ...buildEquipmentFields(dto, equipmentIdList),
  ...buildSystemFields(dto, now),
});

// Helper function to get alert select fields
const getAlertSelectFields = () => ({
  telematic_alert_id: true,
  customer_id: true,
  account_id: true,
  geofence_id: true,
  alert_type_id: true,
  alert_category_id: true,
  status: true,
  delivery_methods: true,
  between_hours_from: true,
  between_hours_to: true,
  specific_days: true,
  start_date: true,
  end_date: true,
  event_duration: true,
  recipients: true,
  recipients_email: true,
  recipients_mobile: true,
  recipients_user_ids: true,
  created_at: true,
  updated_at: true,
  alert_name: true,
  event_low: true,
  event_high: true,
  converted_type: true,
  converted_value: true,
  temperature_unit_id: true,
  equipment_ids: true,
  selected_equipment_ids: true,
  textRecipientsObj: true,
  emailRecipientsObj: true,
  equipmentSelectAll: true,
  webhook: true,
});

// Helper function to handle webhook call
const handleWebhookCall = async (
  dto: CreateTelematicsAlertDto,
  alertId: number,
  equipmentIdList: number[],
  alertData: unknown
) => {
  if (!dto.webhook || !alertId) return;

  try {
    const webhookPayload = createWebhookPayload(dto, alertId, equipmentIdList);
    await callWebhookService(dto.customer_id, alertData, webhookPayload);
  } catch (webhookError) {
    logger.error(
      (webhookError as Error).message ||
        "Webhook call failed during alert creation",
      webhookError
    );
  }
};

export const createTelematicsAlertService = async (
  dto: CreateTelematicsAlertDto
) => {
  const now = new Date();
  const equipmentIdList = await processEquipmentSelection(dto);

  const alertData = buildAlertData(dto, equipmentIdList, now);
  const selectFields = getAlertSelectFields();

  const createdAlert = await prisma.telematic_alert.create({
    data: alertData,
    select: selectFields,
  });

  await handleWebhookCall(
    dto,
    createdAlert.telematic_alert_id,
    equipmentIdList,
    createdAlert
  );

  logger.info(
    "Successfully created telematics alert with ID: %d",
    createdAlert.telematic_alert_id
  );
  return createdAlert;
};

// Helper function to build update-specific system fields (excludes is_deleted, deleted_at, created_at, created_by)
const buildUpdateSystemFields = (dto: CreateTelematicsAlertDto, now: Date) => ({
  deleted_by: dto.deleted_by ?? null,
  updated_at: now,
  updated_by: dto.updated_by ?? null,
  customer_id: dto.customer_id ?? null,
  webhook: dto.webhook ?? false,
});

// Helper function to build update data (excludes is_deleted, deleted_at, created_at, created_by)
const buildUpdateAlertData = (
  dto: CreateTelematicsAlertDto,
  equipmentIdList: number[],
  now: Date
) => ({
  ...buildBasicAlertFields(dto),
  ...buildTemperatureFields(dto),
  ...buildAlertTypeFields(dto),
  ...buildTimeFields(dto, now),
  ...buildRecipientFields(dto),
  ...buildEquipmentFields(dto, equipmentIdList),
  ...buildUpdateSystemFields(dto, now),
});

// Service: handles Prisma ORM update logic
export const updateTelematicsAlertService = async (
  alertId: number,
  dto: CreateTelematicsAlertDto
) => {
  const now = new Date();
  const equipmentIdList = await processEquipmentSelection(dto);

  const updateData = buildUpdateAlertData(dto, equipmentIdList, now);
  const selectFields = getAlertSelectFields();

  const updatedAlert = await prisma.telematic_alert.update({
    where: { telematic_alert_id: alertId },
    data: updateData,
    select: selectFields,
  });

  await handleWebhookCall(
    dto,
    updatedAlert.telematic_alert_id,
    equipmentIdList,
    updatedAlert
  );

  logger.info(
    "Successfully updated telematics alert with ID: %d",
    updatedAlert.telematic_alert_id
  );
  return updatedAlert;
};

export const getTelematicsAlertService = async (id: number) => {
  // Await the Promise to get actual data object
  const alert = await prisma.telematic_alert.findUnique({
    where: { telematic_alert_id: id },
    include: {
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
      customer: true,
      // alert_type: true,
      alert_category: true,
      temperature_unit: {
        select: {
          localization_lookup_id: true,
          locale_code: true,
          locale_name: true,
          temperature_unit: true,
        },
      },
    },
  });

  if (!alert) return null;

  logger.info("Successfully retrieved telematics alert with ID: %d", id);
  const alertTypeIds: number[] = alert.alert_type_id;

  // Fetch event names from alert_type_lookup
  const alertTypeEvents = await prisma.alert_type_lookup.findMany({
    where: { alert_type_lookup_id: { in: alertTypeIds } },
    select: { alert_type_lookup_id: true, event_name: true },
  });

  // Attach alertTypeEvents as a new property
  const response = {
    ...alert,
    alert_type_events: alertTypeEvents,
  };

  return response;
};

// Helper functions to reduce cognitive complexity
const buildBaseWhereClause = (
  custId: number,
  userId?: number
): Record<string, unknown> => {
  const where: Record<string, unknown> = {
    customer_id: custId,
    is_deleted: false,
  };
  if (userId) {
    where.created_by = userId;
  }
  return where;
};

const addScalarFilters = (
  where: Record<string, unknown>,
  query: Record<string, unknown>
): void => {
  if (query.status) where.status = { equals: query.status };
  if (query.event_duration)
    where.event_duration = { equals: query.event_duration };
  if (query.between_hours_from)
    where.between_hours_from = { equals: query.between_hours_from };
  if (query.between_hours_to)
    where.between_hours_to = { equals: query.between_hours_to };
};

const addDateFilters = (
  where: Record<string, unknown>,
  query: Record<string, unknown>
): void => {
  if (
    query.start_date &&
    (typeof query.start_date === "string" ||
      typeof query.start_date === "number" ||
      query.start_date instanceof Date)
  ) {
    where.start_date = { gte: new Date(query.start_date) };
  }
  if (
    query.end_date &&
    (typeof query.end_date === "string" ||
      typeof query.end_date === "number" ||
      query.end_date instanceof Date)
  ) {
    where.end_date = { lte: new Date(query.end_date) };
  }
};

const addRelationalFilters = (
  where: Record<string, unknown>,
  query: Record<string, unknown>
): void => {
  if (query.customer_name) {
    where.customer = {
      customer_name: { contains: query.customer_name, mode: "insensitive" },
    };
  }
  if (query.event_name) {
    where.alert_type = {
      event_name: { contains: query.event_name, mode: "insensitive" },
    };
  }
  if (query.category_name) {
    where.alert_category = {
      category_name: { contains: query.category_name, mode: "insensitive" },
    };
  }
  if (query.alert_category_id) {
    where.alert_category_id = Number(query.alert_category_id);
  }
};

const addRecipientFilters = (
  where: Record<string, unknown>,
  query: Record<string, unknown>
): void => {
  if (query.recipients) {
    const existingOr = (where as { OR?: unknown[] }).OR;
    const safeExistingOr: unknown[] = Array.isArray(existingOr)
      ? existingOr
      : [];
    (where as { OR?: unknown[] }).OR = [
      ...safeExistingOr,
      { recipients_email: { has: query.recipients } },
      { recipients_mobile: { has: query.recipients } },
    ];
  }
};

const addAlertFilters = (
  where: Record<string, unknown>,
  query: Record<string, unknown>
): void => {
  if (query.alert_name) {
    where.alert_name = { contains: query.alert_name, mode: "insensitive" };
  }
  if (query.delivery_method) {
    where.delivery_methods = { hasSome: [Number(query.delivery_method)] };
  }
};

const addUserFilters = (
  where: Record<string, unknown>,
  query: Record<string, unknown>
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

const addTimeFilters = (
  where: Record<string, unknown>,
  query: Record<string, unknown>
): void => {
  interface DateRange {
    gte?: Date;
    lte?: Date;
  }
  type DateInput = string | number | Date;

  if (query.created_from || query.created_to) {
    const createdAt: DateRange = {};
    if (query.created_from) {
      const fromStr = (query.created_from as DateInput).toString();
      createdAt.gte = new Date(fromStr);
    }
    if (query.created_to) {
      const toStr = (query.created_to as DateInput).toString();
      const end = new Date(toStr);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    Object.assign(where, { created_at: createdAt });
  }

  if (query.updated_from || query.updated_to) {
    const updatedAt: DateRange = {};
    if (query.updated_from) {
      const fromStr = (query.updated_from as DateInput).toString();
      updatedAt.gte = new Date(fromStr);
    }
    if (query.updated_to) {
      const toStr = (query.updated_to as DateInput).toString();
      const end = new Date(toStr);
      end.setHours(23, 59, 59, 999);
      updatedAt.lte = end;
    }
    Object.assign(where, { updated_at: updatedAt });
  }
};

export const getTelematicsAlertsByUserService = async (
  custId: number,
  page: number,
  perPage: number,
  query: Record<string, unknown>,
  userId?: number
) => {
  const { skip, take } = getPagination({ page, perPage });

  const where = buildBaseWhereClause(custId, userId);
  addScalarFilters(where, query);
  addDateFilters(where, query);
  addRelationalFilters(where, query);
  addRecipientFilters(where, query);
  addAlertFilters(where, query);
  addUserFilters(where, query);
  addTimeFilters(where, query);

  const orderBy = buildOrderByFromSort(
    typeof query.sort === "string" ? query.sort : undefined,
    TELEMATICS_ALERT_SORT_FIELDS,
    "created_at"
  );
  // Fetch alerts for user
  const alerts = await prisma.telematic_alert.findMany({
    where,
    skip,
    take,
    orderBy,
    include: {
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
      customer: true,
      alert_category: {
        select: {
          category_name: true,
        },
      },
      temperature_unit: {
        select: {
          localization_lookup_id: true,
          locale_code: true,
          locale_name: true,
          temperature_unit: true,
        },
      },
    },
  });

  const allAlertTypeIds = Array.from(
    new Set(
      alerts.flatMap((alert) =>
        Array.isArray(alert.alert_type_id) ? alert.alert_type_id : []
      )
    )
  );

  const allAccountIds = Array.from(
    new Set(
      alerts.flatMap((a) => (Array.isArray(a.account_id) ? a.account_id : []))
    )
  );
  const allGeofenceAccountIds = Array.from(
    new Set(
      alerts.flatMap((a) => (Array.isArray(a.geofence_id) ? a.geofence_id : []))
    )
  );

  const allDeliveryMethodIds = Array.from(
    new Set(
      alerts.flatMap((a) =>
        Array.isArray(a.delivery_methods) ? a.delivery_methods : []
      )
    )
  );

  const deliveryMethods = await prisma.delivery_method_lookup.findMany({
    where: { delivery_id: { in: allDeliveryMethodIds } },
    select: { delivery_id: true, method_type: true },
  });
  const alertTypeEvents = await prisma.alert_type_lookup.findMany({
    where: { alert_type_lookup_id: { in: allAlertTypeIds } },
    select: { alert_type_lookup_id: true, event_name: true },
  });

  // Fetch related accounts
  const accounts = await prisma.account.findMany({
    where: { account_id: { in: allAccountIds }, is_deleted: false },
    select: { account_id: true, account_name: true, account_number: true },
  });

  // Fetch related geofence accounts
  const geofence = await prisma.geofence.findMany({
    where: {
      geofence_id: { in: allGeofenceAccountIds },
      is_deleted: false,
    },
    select: {
      geofence_id: true,
      geofence_name: true,
      description: true,
    },
  });

  const mappedAlerts = alerts.map((alert) => {
    return {
      ...alert,
      alert_type_events: alertTypeEvents.filter((event) =>
        alert.alert_type_id.includes(event.alert_type_lookup_id)
      ),
      accounts: accounts.filter((acc) =>
        alert.account_id.includes(acc.account_id)
      ),
      geofence: geofence.filter((gfa) =>
        alert.geofence_id.includes(gfa.geofence_id)
      ),
      deliveryMethods: deliveryMethods.filter((dm) =>
        alert.delivery_methods.includes(dm.delivery_id)
      ),
    };
  });

  const total = await prisma.telematic_alert.count({
    where,
  });

  const meta = getPaginationMeta(total, page, perPage);
  logger.info(
    "Successfully retrieved %d telematics alerts for customer: %d",
    mappedAlerts.length,
    custId
  );
  return { alerts: mappedAlerts, meta };
};

// Helper function to filter alerts based on download criteria
const filterAlertsForDownload = (
  alerts: Record<string, unknown>[],
  query: DownloadQuery
): Record<string, unknown>[] => {
  if (!Array.isArray(query.download_ids)) return alerts;

  const idsSet = new Set(query.download_ids);
  return query.downloadAll
    ? alerts.filter((a) => !idsSet.has(a.telematic_alert_id as number))
    : alerts.filter((a) => idsSet.has(a.telematic_alert_id as number));
};

// Helper function to prepare Excel columns
const prepareExcelColumns = (columns: ColumnDefinition[]) => [
  { header: "S.No", key: "sno", width: 8 },
  ...columns.map((col) => ({
    header: col.label,
    key: col.field,
    width: col.width ?? 25,
  })),
];

// Utility formatters
type UserInfo = { first_name?: string; last_name?: string } | null | undefined;
type DateValue = string | Date | null | undefined;

const formatUserName = (user: UserInfo): string =>
  user ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() : "N/A";

const formatDate = (date: DateValue): string =>
  date ? new Date(date).toLocaleString("en-GB", { hour12: true }) : "N/A";

// Helper functions to reduce cognitive complexity in formatAlertData
const formatBasicFields = (
  row: Record<string, unknown>,
  col: ColumnDefinition,
  alertTyped: Record<string, unknown>
): void => {
  switch (col.field) {
    case "geofence_alert_name":
    case "alert_name":
      row[col.field] = alertTyped.alert_name ?? "N/A";
      break;
    case "status":
      row[col.field] = alertTyped.status ?? "N/A";
      break;
    case "alert_category":
      row[col.field] =
        (alertTyped.alert_category as { category_name?: string })
          ?.category_name ?? "N/A";
      break;
  }
};

const formatArrayFields = (
  row: Record<string, unknown>,
  col: ColumnDefinition,
  alertTyped: Record<string, unknown>
): void => {
  switch (col.field) {
    case "events":
    case "event_name":
      row[col.field] = Array.isArray(alertTyped.alert_type_events)
        ? (alertTyped.alert_type_events as { event_name: string }[])
            .map((e) => e.event_name)
            .join(", ")
        : "N/A";
      break;
    case "deliveryMethods":
    case "delivery_method":
      row[col.field] = Array.isArray(alertTyped.deliveryMethods)
        ? (alertTyped.deliveryMethods as { method_type: string }[])
            .map((dm) => dm.method_type)
            .join(", ")
        : "N/A";
      break;
  }
};

const formatUserFields = (
  row: Record<string, unknown>,
  col: ColumnDefinition,
  alertTyped: Record<string, unknown>
): void => {
  switch (col.field) {
    case "recipients":
      row[col.field] =
        (Array.isArray(alertTyped.recipients_email)
          ? (alertTyped.recipients_email as string[]).join(", ")
          : "") +
        (Array.isArray(alertTyped.recipients_mobile) &&
        (alertTyped.recipients_mobile as string[]).length
          ? " | " + (alertTyped.recipients_mobile as string[]).join(", ")
          : "");
      break;
    case "created_by":
      row[col.field] = formatUserName(alertTyped.created_by_user as UserInfo);
      break;
    case "last_modified_by":
    case "updated_by":
      row[col.field] = formatUserName(alertTyped.updated_by_user as UserInfo);
      break;
  }
};

const formatDateFields = (
  row: Record<string, unknown>,
  col: ColumnDefinition,
  alertTyped: Record<string, unknown>
): void => {
  switch (col.field) {
    case "created_at":
      row[col.field] = formatDate(alertTyped.created_at as DateValue);
      break;
    case "last_modified_date":
    case "last_modified_at":
    case "updated_at":
      row[col.field] = formatDate(alertTyped.updated_at as DateValue);
      break;
  }
};

// Helper function to format alert data for export
const formatAlertData = (
  alert: Record<string, unknown>,
  index: number,
  body: DownloadRequestBody
): Record<string, unknown> => {
  const row: Record<string, unknown> = { sno: index + 1 };
  interface AlertTypeEvent {
    event_name: string;
  }
  interface DeliveryMethod {
    method_type: string;
  }
  interface User {
    first_name?: string;
    last_name?: string;
  }
  interface AlertRow {
    [key: string]: unknown;
    alert_name?: string;
    status?: string;
    alert_type_events?: AlertTypeEvent[];
    alert_category?: { category_name?: string };
    deliveryMethods?: DeliveryMethod[];
    recipients_email?: string[];
    recipients_mobile?: string[];
    created_by_user?: User;
    updated_by_user?: User;
    created_at?: string | Date | null;
    updated_at?: string | Date | null;
  }
  const alertTyped = alert as AlertRow;

  const handledFields = [
    "geofence_alert_name",
    "alert_name",
    "status",
    "events",
    "event_name",
    "alert_category",
    "deliveryMethods",
    "delivery_method",
    "recipients",
    "created_by",
    "last_modified_by",
    "updated_by",
    "created_at",
    "last_modified_date",
    "last_modified_at",
    "updated_at",
  ];

  for (const col of body.columns) {
    formatBasicFields(row, col, alertTyped);
    formatArrayFields(row, col, alertTyped);
    formatUserFields(row, col, alertTyped);
    formatDateFields(row, col, alertTyped);

    if (!handledFields.includes(col.field)) {
      if (typeof col.formatter === "function") {
        row[col.field] = col.formatter(alertTyped[col.field], alertTyped);
      } else {
        row[col.field] = alertTyped[col.field] ?? "N/A";
      }
    }
  }
  return row;
};

// Helper function to auto-fit Excel columns
const autoFitColumns = (worksheet: ExcelJS.Worksheet): void => {
  worksheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      let cellValue: string;
      if (cell.value === null || cell.value === undefined) {
        cellValue = "";
      } else if (typeof cell.value === "object") {
        cellValue = JSON.stringify(cell.value);
      } else {
        cellValue = cell.value.toString();
      }
      if (cellValue.length > maxLength) maxLength = cellValue.length;
    });
    column.width = maxLength + 2;
  });
};

// Helper function to save file locally if in LOCAL environment
const saveFileLocally = (filename: string, buffer: Buffer): void => {
  const environment = process.env.ENVIRONMENT ?? "production";
  if (environment === "LOCAL") {
    if (!fs.existsSync("activity_feed")) {
      fs.mkdirSync("activity_feed");
    }
    fs.writeFileSync(`activity_feed/${filename}`, buffer);
  }
};

export const downloadTelematicsAlertsByUserService = async (
  custId: number,
  query: Record<string, unknown>,
  body: DownloadRequestBody,
  userId?: number
) => {
  // Get all alerts (no page/perPage restriction for export)
  const { alerts } = await getTelematicsAlertsByUserService(
    custId,
    1,
    1000000,
    { ...query, ...body.query },
    userId
  );
  if (!alerts.length) throw new Error("NO_ALERTS_FOUND");

  // Filter alerts based on download criteria
  const filteredAlerts = filterAlertsForDownload(alerts, body.query);

  // Prepare Excel columns and format data
  const columns = prepareExcelColumns(body.columns);
  const formattedData = filteredAlerts.map((alert, index) =>
    formatAlertData(alert, index, body)
  );

  // Generate Excel file
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Telematics Alerts");
  worksheet.columns = columns;
  worksheet.addRows(formattedData);
  autoFitColumns(worksheet);

  // Create filename and buffer
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
  const filename = `customer_${custId}_telematics_alerts_${timestamp}.xlsx`;
  const bufferArray = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(bufferArray as ArrayBuffer);

  saveFileLocally(filename, buffer);

  logger.info(
    "Successfully generated telematics alerts download file: %s",
    filename
  );
  return { buffer, filename };
};

// Service to toggle telematic alert status
export const toggleTelematicAlertStatus = async (
  telematicAlertId: number
): Promise<string> => {
  // Fetch current status of the telematic alert
  const alert = await prisma.telematic_alert.findUnique({
    where: { telematic_alert_id: telematicAlertId },
    select: { status: true },
  });
  if (!alert) {
    throw new Error("Telematic alert not found");
  }

  // Determine new status by toggling current status
  const newStatus = alert.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";

  // Update the status field in the database
  await prisma.telematic_alert.update({
    where: { telematic_alert_id: telematicAlertId },
    data: { status: newStatus },
    select: { status: true },
  });

  logger.info(
    "Successfully toggled telematics alert status to: %s for ID: %d",
    newStatus,
    telematicAlertId
  );
  return newStatus;
};

export const UserService = {
  async fetchUsersByAccounts(
    dto: FetchUsersByAccountsDto,
    pagination: PaginationParams,
    filters?: Record<string, unknown>
  ): Promise<{ users: UserResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, perPage } = getPagination(pagination);

    const whereClause: Record<string, unknown> = {};

    if (dto.customer_id !== undefined && dto.customer_id !== null) {
      // Fetch by customer_id from user table
      whereClause.customer_id = dto.customer_id;
    } else if (dto.account_ids?.length) {
      // Existing flow for assigned_account_ids
      whereClause.assigned_account_ids = { hasSome: dto.account_ids };
    }

    // Add filters with if conditions (no loops)
    if (filters) {
      // Handle user_role_id as a separate filter (not a string search)
      if (filters.user_role_id) {
        Object.assign(whereClause, {
          user_role_id: Number(filters.user_role_id),
        });
      }

      // Universal string search across relevant columns
      if (filters.recipients) {
        Object.assign(whereClause, {
          OR: [
            {
              first_name: { contains: filters.recipients, mode: "insensitive" },
            },
            {
              last_name: { contains: filters.recipients, mode: "insensitive" },
            },
            { email: { contains: filters.recipients, mode: "insensitive" } },
            {
              phone_number: {
                contains: filters.recipients,
                mode: "insensitive",
              },
            },
            {
              user_role_ref: {
                name: { contains: filters.recipients, mode: "insensitive" },
              },
            },
            {
              user_role_ref: {
                description: {
                  contains: filters.recipients,
                  mode: "insensitive",
                },
              },
            },
          ],
        });
      }
    }

    const total = await prisma.user.count({ where: whereClause });

    const usersdata = await prisma.user.findMany({
      where: whereClause,
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        user_role_id: true,
        user_role_ref: {
          select: { name: true, description: true },
        },
      },
      skip,
      take,
    });

    const users = usersdata.map((u) => ({
      user_id: u.user_id,
      first_name: u.first_name,
      last_name: u.last_name,
      email: u.email,
      phone_number: u.phone_number,
      user_role_id: u.user_role_id,
      role_name: u.user_role_ref?.name ?? "",
      role_description: u.user_role_ref?.description ?? null,
    }));

    const meta = getPaginationMeta(total, page, perPage);

    logger.info("Successfully retrieved %d users", users.length);
    return { users, meta };
  },
};

export const EquipmentService = {
  async fetchEquipmentByAccounts(
    dto: FetchEquipmentByAccountsDto,
    pagination: PaginationParams,
    filters?: Record<string, unknown>
  ): Promise<{ equipment: EquipmentResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, perPage } = getPagination(pagination);
    let accountIdsToQuery: number[] = [];

    if (dto.customer_id) {
      // Fetch account_ids under provided customer_id
      const accounts = await prisma.account.findMany({
        where: { customer_id: dto.customer_id },
        select: { account_id: true },
      });
      accountIdsToQuery = accounts.map((acc) => acc.account_id);
    } else {
      accountIdsToQuery = dto.account_ids;
    }

    // Base where clause to filter by account_ids nested in equipment_assignment relation
    const whereClause: Record<string, unknown> = {
      equipment_assignment: {
        some: {
          equipment_type_allocation_ref: {
            account_id: { in: accountIdsToQuery },
          },
        },
      },
    };

    if (filters) {
      const andConditions = [];

      if (filters.unit_number) {
        andConditions.push({
          unit_number: { contains: filters.unit_number, mode: "insensitive" },
        });
      }
      if (filters.customer_unit_number) {
        andConditions.push({
          customer_unit_number: {
            contains: filters.customer_unit_number,
            mode: "insensitive",
          },
        });
      }
      if (filters.description) {
        andConditions.push({
          description: { contains: filters.description, mode: "insensitive" },
        });
      }
      if (filters.status) {
        andConditions.push({
          status: { equals: filters.status, mode: "insensitive" },
        });
      }

      if (andConditions.length) {
        whereClause.AND = andConditions;
      }
    }

    const total = await prisma.equipment.count({
      where: whereClause,
    });

    const equipment = await prisma.equipment.findMany({
      where: whereClause,
      select: {
        equipment_id: true,
        unit_number: true,
        customer_unit_number: true,
        description: true,
        status: true,
      },
      skip,
      take,
    });

    const meta = getPaginationMeta(total, page, perPage);

    logger.info("Successfully retrieved %d equipment items", equipment.length);
    return { equipment, meta };
  },

  async fetchEquipmentByAccountsOrCustIdAndEvents(
    dto: FetchEquipmentByAccountsEventsDto,
    pagination: PaginationParams,
    filters?: EquipmentFilters
  ): Promise<{ equipment: EquipmentResponseDto[]; meta: PaginationMeta }> {
    const { skip, take, page, perPage } = getPagination(pagination);

    let accountIdsToQuery: number[] = [];

    if (dto.customer_id) {
      // Fetch account_ids under provided customer_id
      const accounts = await prisma.account.findMany({
        where: { customer_id: dto.customer_id },
        select: { account_id: true },
      });
      accountIdsToQuery = accounts.map((acc) => acc.account_id);
    } else {
      accountIdsToQuery = dto.account_ids;
    }

    // Base where clause to filter by account_ids nested in equipment_assignment relation
    const whereClause: Record<string, unknown> = {
      equipment_assignment: {
        some: {
          equipment_type_allocation_ref: {
            account_id: { in: accountIdsToQuery },
          },
        },
      },
    };

    // Apply filters using helper functions
    addEquipmentFilters(whereClause, filters);

    // Count total filtered equipment
    const total = await prisma.equipment.count({
      where: whereClause,
    });

    // Fetch filtered equipment data with pagination
    const equipment = await prisma.equipment.findMany({
      where: whereClause,
      select: {
        equipment_id: true,
        unit_number: true,
        telematic_device_id: true,
        customer_unit_number: true,
        description: true,
        status: true,
        trailer_height: true,
        trailer_length: true,
        trailer_width: true,
        equipment_type_lookup_ref: {
          select: {
            equipment_type: true,
          },
        },
        oem_make_model_ref: {
          select: {
            make: true,
            model: true,
            year: true,
          },
        },
        oem_ref: {
          select: {
            manufacturer_code: true,
            manufacturer_name: true,
          },
        },
        equipment_iot_device_ref: {
          select: {
            iot_device_ref: {
              select: {
                iot_device_vendor_ref: {
                  select: {
                    vendor_name: true,
                  },
                },
              },
            },
          },
        },
      },
      skip,
      take,
    });

    const meta = getPaginationMeta(total, page, perPage);

    logger.info(
      "Successfully retrieved %d equipment items with events",
      equipment.length
    );
    return { equipment, meta };
  },
};

// Helper functions to reduce cognitive complexity in addEquipmentFilters
const addBasicEquipmentFilters = (
  whereClause: Record<string, unknown>,
  filters: EquipmentFilters
): void => {
  if (filters.unit_number)
    whereClause.unit_number = {
      contains: filters.unit_number,
      mode: "insensitive",
    };
  if (filters.trailer_height)
    whereClause.trailer_height = {
      contains: filters.trailer_height,
      mode: "insensitive",
    };
  if (filters.trailer_length)
    whereClause.trailer_length = {
      contains: filters.trailer_length,
      mode: "insensitive",
    };
  if (filters.trailer_width)
    whereClause.trailer_width = {
      contains: filters.trailer_width,
      mode: "insensitive",
    };
  if (filters.customer_unit_number)
    whereClause.customer_unit_number = {
      contains: filters.customer_unit_number,
      mode: "insensitive",
    };
  if (filters.equipment_id)
    whereClause.equipment_id = { equals: Number(filters.equipment_id) };
  if (filters.status) whereClause.status = { equals: filters.status };
  if (filters.description)
    whereClause.description = {
      contains: filters.description,
      mode: "insensitive",
    };
};

const addOemFilters = (
  whereClause: Record<string, unknown>,
  filters: EquipmentFilters
): void => {
  if (filters.equipment_type)
    whereClause.equipment_type_lookup_ref = {
      equipment_type: { contains: filters.equipment_type, mode: "insensitive" },
    };
  if (filters.make)
    whereClause.oem_make_model_ref = {
      make: { contains: filters.make, mode: "insensitive" },
    };
  if (filters.model)
    whereClause.oem_make_model_ref = {
      model: { contains: filters.model, mode: "insensitive" },
    };
  if (filters.year)
    whereClause.oem_make_model_ref = { year: { equals: Number(filters.year) } };
  if (filters.manufacturer_code)
    whereClause.oem_ref = {
      manufacturer_code: {
        contains: filters.manufacturer_code,
        mode: "insensitive",
      },
    };
  if (filters.manufacturer_name)
    whereClause.oem_ref = {
      manufacturer_name: {
        contains: filters.manufacturer_name,
        mode: "insensitive",
      },
    };
};

// Helper function to add equipment filters
const addEquipmentFilters = (
  whereClause: Record<string, unknown>,
  filters?: EquipmentFilters
): void => {
  if (!filters) return;

  if (filters.global_unit_number) {
    whereClause.OR = [
      {
        unit_number: {
          contains: filters.global_unit_number,
          mode: "insensitive",
        },
      },
      {
        customer_unit_number: {
          contains: filters.global_unit_number,
          mode: "insensitive",
        },
      },
    ];
  }

  addBasicEquipmentFilters(whereClause, filters);
  addOemFilters(whereClause, filters);

  if (filters.vendor_name) {
    whereClause.equipment_iot_device_ref = {
      iot_device_ref: {
        iot_device_vendor_ref: {
          vendor_name: { contains: filters.vendor_name, mode: "insensitive" },
        },
      },
    };
  }
};

interface EquipmentFilters {
  global_unit_number?: string;
  unit_number?: string;
  trailer_height?: string;
  trailer_length?: string;
  trailer_width?: string;
  customer_unit_number?: string;
  equipment_id?: number | string;
  status?: string;
  description?: string;
  equipment_type?: string;
  make?: string;
  model?: string;
  year?: number | string;
  manufacturer_code?: string;
  manufacturer_name?: string;
  vendor_name?: string;
  // Add other filter fields as needed
}

///all the ES LINt issuees are closed from this commit
