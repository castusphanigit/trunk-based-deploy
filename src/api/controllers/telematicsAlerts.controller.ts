import { Request, Response } from "express";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../../utils/responseUtils";
import {
  createTelematicsAlertService,
  getTelematicsAlertService,
  getTelematicsAlertsByUserService,
  downloadTelematicsAlertsByUserService,
  UserService,
  EquipmentService,
  updateTelematicsAlertService,
  toggleTelematicAlertStatus,
  DownloadRequestBody,
} from "../../services/telematicsAlert.service";
import {
  CreateTelematicsAlertDto,
  FetchUsersByAccountsDto,
  FetchEquipmentByAccountsDto,
  FetchEquipmentByAccountsEventsDto,
} from "../../types/dtos/telematicsAlert-request.dto";
import { PaginationParams } from "src/utils/pagination";

/**
 * Creates a new telematics alert
 * Validates required fields and creates alert in the database
 *
 * @param req - Express request object containing alert data
 * @param res - Express response object
 * @returns Created alert data or error response
 * @author chaitanya
 */
export const createTelematicsAlert = async (req: Request, res: Response) => {
  try {
    const dto = req.body as CreateTelematicsAlertDto;
    if (!dto.events_id || !dto.status) {
      return sendErrorResponse(res, "Missing required fields", 400);
    }
    const alert = await createTelematicsAlertService(dto);
    return sendSuccessResponse(res, alert, "Alert created successfully");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("createTelematicsAlert error:", error);
    return sendErrorResponse(res, "Internal server error");
  }
};
/**
 * Updates an existing telematics alert
 * Validates required fields and updates alert in the database
 *
 * @param req - Express request object with alert ID and update data
 * @param res - Express response object
 * @returns Updated alert data or error response
 * @author chaitanya
 */
export const updateTelematicsAlert = async (req: Request, res: Response) => {
  try {
    const alertId = Number(req.params.id);
    const body = req.body as Partial<CreateTelematicsAlertDto>;
    // Validate required fields before assignment
    if (typeof body !== "object" || body === null) {
      return sendErrorResponse(res, "Invalid request body", 400);
    }
    if (typeof body.status !== "string") {
      return sendErrorResponse(res, "Missing required fields", 400);
    }
    const dto: CreateTelematicsAlertDto = {
      events_id: body.events_id,
      status: body.status,
      ...(body as Omit<CreateTelematicsAlertDto, "events_id" | "status">),
    };

    if (!alertId) {
      return sendErrorResponse(res, "Missing alert ID", 400);
    }

    if (!dto.status) {
      return sendErrorResponse(res, "Missing required fields", 400);
    }

    const updatedAlert = await updateTelematicsAlertService(alertId, dto);
    return sendSuccessResponse(res, updatedAlert, "Alert updated successfully");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("updateTelematicsAlert error:", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2025"
    ) {
      return sendErrorResponse(res, "Alert not found", 404);
    }
    return sendErrorResponse(res, "Internal server error");
  }
};

/**
 * Retrieves a telematics alert by ID
 * Fetches a specific alert using its unique identifier
 *
 * @param req - Express request object with alert ID parameter
 * @param res - Express response object
 * @returns Alert data or error response
 * @author chaitanya
 */
export const getTelematicsAlert = async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return sendErrorResponse(res, "Invalid ID", 400);

    const alert = await getTelematicsAlertService(id);
    if (!alert) return sendErrorResponse(res, "Alert not found", 404);
    const normalizedAlert = normalizeAlertResponse(alert);
    return sendSuccessResponse(
      res,
      normalizedAlert,
      "Alert fetched successfully"
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("getTelematicsAlert error:", error);
    return sendErrorResponse(res, "Internal server error");
  }
};
/**
 * Normalizes alert response data
 * Converts operator_value to number format for consistent API response
 *
 * @param alert - Alert data object to normalize
 * @returns Normalized alert object
 * @author chaitanya
 */
function normalizeAlertResponse(alert: Record<string, unknown>) {
  if (
    alert.operator_value &&
    typeof alert.operator_value === "object" &&
    "toNumber" in alert.operator_value
  ) {
    alert.operator_value = (
      alert.operator_value as { toNumber: () => number }
    ).toNumber();
  } else if (typeof alert.operator_value === "string") {
    alert.operator_value = Number(alert.operator_value);
  }
  return alert;
}

/**
 * Retrieves telematics alerts by user
 * Fetches paginated alerts for a specific customer and optionally filtered by user
 *
 * @param req - Express request object with customer ID and optional user ID
 * @param res - Express response object
 * @returns Paginated alerts data or error response
 * @author chaitanya
 */
export const getTelematicsAlertsByUser = async (
  req: Request,
  res: Response
) => {
  try {
    const custId = Number(req.params.custId);
    const userIdFromParams =
      typeof req.params.userId === "string" && req.params.userId.length
        ? Number(req.params.userId)
        : undefined;
    const userIdFromQuery =
      typeof req.query.userId === "string" ||
      typeof req.query.userId === "number"
        ? Number(req.query.userId)
        : undefined;
    const userId = userIdFromParams ?? userIdFromQuery;

    if (!custId) {
      return sendErrorResponse(res, "Missing or invalid custId", 400);
    }

    const page = Number(req.query.page) || 1;
    const perPage = Number(req.query.perPage) || 20;

    const { alerts, meta } = await getTelematicsAlertsByUserService(
      custId,
      page,
      perPage,
      req.query,
      userId
    );

    return sendSuccessResponse(
      res,
      { alerts, meta },
      "User alerts fetched successfully"
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("getTelematicsAlertsByUser error:", error);
    return sendErrorResponse(res, "Internal server error");
  }
};

/**
 * Downloads telematics alerts as Excel file
 * Generates and downloads alerts data in Excel format for a specific user
 *
 * @param req - Express request object with customer ID and optional user ID
 * @param res - Express response object for file download
 * @returns Excel file download or error response
 * @author chaitanya
 */
export const downloadTelematicsAlertsByUser = async (
  req: Request,
  res: Response
) => {
  try {
    const custId = Number(req.params.custId);
    const userIdFromParams =
      typeof req.params.userId === "string" && req.params.userId.length
        ? Number(req.params.userId)
        : undefined;
    const userIdFromQuery =
      typeof req.query.userId === "string" ||
      typeof req.query.userId === "number"
        ? Number(req.query.userId)
        : undefined;
    const userId = userIdFromParams ?? userIdFromQuery;
    if (!custId) {
      return sendErrorResponse(res, "Missing or invalid custId", 400);
    }

    const { buffer, filename } = await downloadTelematicsAlertsByUserService(
      custId,
      req.query as Record<string, unknown>,
      req.body as DownloadRequestBody, // expects { columns, query } in body
      userId
    );

    //  Send file as download
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.send(buffer);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("downloadTelematicsAlertsByUser error:", error);
    return sendErrorResponse(res, "Internal server error");
  }
};

/**
 * Fetches users by account IDs
 * Retrieves paginated user data filtered by specific account IDs
 *
 * @param req - Express request object with account IDs and pagination parameters
 * @param res - Express response object
 * @returns Paginated users data or error response
 * @author chaitanya
 */
export const fetchUsersByAccounts = async (req: Request, res: Response) => {
  try {
    const dto = req.body as Partial<FetchUsersByAccountsDto>;
    const pagination: PaginationParams = {
      page:
        typeof req.query.page === "string" || typeof req.query.page === "number"
          ? (req.query.page as string | number).toString()
          : undefined,
      perPage:
        typeof req.query.perPage === "string" ||
        typeof req.query.perPage === "number"
          ? (req.query.perPage as string | number).toString()
          : undefined,
    };

    if (!dto.account_ids || !Array.isArray(dto.account_ids)) {
      return sendErrorResponse(res, "account_ids must be an array");
    }

    const { users, meta } = await UserService.fetchUsersByAccounts(
      dto as FetchUsersByAccountsDto,
      pagination,
      req.query
    );

    return sendSuccessResponse(res, { users, meta });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("fetchUsersByAccounts error:", err);
    return sendErrorResponse(res, "Internal server error");
  }
};

/**
 * Toggles telematics alert status
 * Switches alert status between active and inactive states
 *
 * @param req - Express request object with alert ID parameter
 * @param res - Express response object
 * @returns Updated status data or error response
 * @author chaitanya
 */
export const toggleTelematicAlertStatusCtrl = async (
  req: Request,
  res: Response
) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return sendErrorResponse(res, "Valid telematic_alert_id is required");
    }

    const newStatus = await toggleTelematicAlertStatus(Number(id));

    return sendSuccessResponse(res, newStatus, "Status Changed Successfully");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Status changed error:", err);
    return sendErrorResponse(res, "Internal server error");
  }
};

/**
 * Fetches equipment by account IDs
 * Retrieves paginated equipment data filtered by specific account IDs
 *
 * @param req - Express request object with account IDs and pagination parameters
 * @param res - Express response object
 * @returns Paginated equipment data or error response
 * @author chaitanya
 */
export const fetchEquipmentByAccounts = async (req: Request, res: Response) => {
  try {
    const dto = req.body as unknown as FetchEquipmentByAccountsDto;
    const pagination: PaginationParams = {
      page:
        typeof req.query.page === "string" || typeof req.query.page === "number"
          ? (req.query.page as string | number).toString()
          : undefined,
      perPage:
        typeof req.query.perPage === "string" ||
        typeof req.query.perPage === "number"
          ? (req.query.perPage as string | number).toString()
          : undefined,
    };

    if (!dto.account_ids || !Array.isArray(dto.account_ids)) {
      return sendErrorResponse(res, "account_ids must be an array");
    }

    const { equipment, meta } = await EquipmentService.fetchEquipmentByAccounts(
      dto,
      pagination,
      req.query as Record<string, unknown>
    );

    return sendSuccessResponse(res, { equipment, meta });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("fetchEquipmentByAccounts error:", err);
    return sendErrorResponse(res, "Internal server error");
  }
};

/**
 * Fetches equipment by account IDs or customer ID and events
 * Retrieves paginated equipment data filtered by account IDs or customer ID with event filtering
 *
 * @param req - Express request object with account IDs, customer ID, and event parameters
 * @param res - Express response object
 * @returns Paginated equipment data or error response
 * @author chaitanya
 */
export const fetchEquipmentByAccountsOrCustIdAndEvents = async (
  req: Request,
  res: Response
) => {
  try {
    const dto = req.body as unknown as FetchEquipmentByAccountsEventsDto;
    const pagination: PaginationParams = {
      page:
        typeof req.query.page === "string" || typeof req.query.page === "number"
          ? (req.query.page as string | number).toString()
          : undefined,
      perPage:
        typeof req.query.perPage === "string" ||
        typeof req.query.perPage === "number"
          ? (req.query.perPage as string | number).toString()
          : undefined,
    };

    if (!dto.account_ids || !Array.isArray(dto.account_ids)) {
      return sendErrorResponse(res, "account_ids must be an array");
    }

    const { equipment, meta } =
      await EquipmentService.fetchEquipmentByAccountsOrCustIdAndEvents(
        dto,
        pagination,
        req.query as Record<string, unknown>
      );

    return sendSuccessResponse(res, { equipment, meta });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("fetchEquipmentByAccounts error:", err);
    return sendErrorResponse(res, "Internal server error");
  }
};
