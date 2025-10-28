/**
 * Fleet View Controller
 *
 * Handles HTTP requests for fleet-related operations including:
 * - Fetching fleet list view with filtering and pagination
 * - Getting detailed equipment information
 * - Downloading fleet data as Excel files
 * - Retrieving telematics data for specific units
 *
 * Security considerations:
 * - All endpoints require proper authentication
 * - Input validation and sanitization
 * - Authorization checks for data access
 * - Rate limiting on export operations
 *
 * @author Rajeswari
 * @version 1.0.0
 */

import { Request, Response } from "express";
import {
  downloadListViewService,
  getEquipmentDetailsService,
  getListViewService,
  fetchTelematics,
  getEquipmentGateInspectionsService,
} from "../../services/fleet.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
  sendPaginatedBigIntResponse,
} from "../../utils/responseUtils";
import { GetListViewParams } from "../../types/dtos/fleet.dto";
import { ColumnDefinition } from "../../types/common/request.types";
import logger from "../../utils/logger";

/**
 * Parse account IDs from request query
 *
 * @param accountIdQuery - Raw account ID query parameter
 * @returns Array of parsed account IDs
 */
const parseAccountIds = (accountIdQuery: string): number[] => {
  // Try parsing as JSON array first
  try {
    const parsed = JSON.parse(accountIdQuery) as (string | number)[];
    if (Array.isArray(parsed)) {
      return parsed
        .map((id) => (typeof id === "number" ? id : Number(id)))
        .filter((id): id is number => !isNaN(id));
    }
  } catch {
    // Fallback: comma-separated string
    try {
      return accountIdQuery
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id): id is number => !isNaN(id));
    } catch (splitError) {
      throw new Error(
        `Failed to parse account_id: ${
          splitError instanceof Error ? splitError.message : "Unknown error"
        }`
      );
    }
  }
  return [];
};

/**
 * Get Fleet List View
 *
 * Retrieves a paginated list of fleet equipment with filtering, sorting, and statistics.
 * Supports complex filtering by equipment properties, account information, and contract details.
 *
 * @param req - Express request object containing query parameters
 * @param req.query.account_id - Array of account IDs or comma-separated string
 * @param req.query.page - Page number for pagination (default: 1)
 * @param req.query.perPage - Items per page (default: 10)
 * @param req.query.sort - Sorting configuration
 * @param req.query - Additional filter parameters for equipment properties
 * @param res - Express response object
 *
 * @returns Promise<void> - Sends paginated response with fleet data and statistics
 *
 * @throws {Error} When account_ids are invalid or service fails
 *
 * @example
 * GET /api/fleet/list?account_id=[1,2,3]&page=1&perPage=10&unitNumber=ABC123
 */
export const getListView = async (req: Request, res: Response) => {
  try {
    logger.info("Starting getListView request", { query: req.query });

    const account_ids = req.query.account_id
      ? parseAccountIds(req.query.account_id as string)
      : [];

    const { data, total, page, perPage, stats } = await getListViewService({
      ...req.query,
      account_ids,
    });

    logger.info("getListView request completed successfully", {
      total,
      page,
      perPage,
      dataCount: data.length,
    });

    sendPaginatedBigIntResponse(res, { stats, data }, total, page, perPage, {
      statusCode: 200,
      message: "List view details fetched successfully",
    });
    return;
  } catch (err: unknown) {
    logger.error("getListView request failed", {
      error: err instanceof Error ? err.message : "Unknown error",
      query: req.query,
    });
    return sendErrorResponse(
      res,
      (err as Error).message || "Failed to fetch listview data"
    );
  }
};

/**
 * Get Equipment Details
 *
 * Retrieves detailed information for a specific piece of equipment including
 * specifications, contact details, attachments, and GPS information.
 *
 * @param req - Express request object containing query parameters
 * @param req.query.account_id - Account ID (required)
 * @param req.query.equipment_id - Equipment ID (required)
 * @param res - Express response object
 *
 * @returns Promise<void> - Sends equipment details or 404 if not found
 *
 * @throws {Error} When account_id or equipment_id are invalid
 *
 * @example
 * GET /api/fleet/equipment-details?account_id=123&equipment_id=456
 */
export const getEquipmentDetails = async (req: Request, res: Response) => {
  try {
    logger.info("Starting getEquipmentDetails request", { query: req.query });
    const accountId = Number(req.query.account_id);
    const equipmentId = Number(req.query.equipment_id);

    if (isNaN(accountId) || isNaN(equipmentId)) {
      logger.error("getEquipmentDetails request failed - invalid parameters", {
        accountId,
        equipmentId,
        query: req.query,
      });
      return res
        .status(400)
        .json({ message: "Invalid account ID or equipment ID" });
    }

    const details = await getEquipmentDetailsService({
      accountId,
      equipmentId,
    });

    if (!details) {
      logger.error("getEquipmentDetails request failed - equipment not found", {
        accountId,
        equipmentId,
      });
      return res.status(404).json({
        message: "No equipment found for the given account ID and equipment ID",
      });
    }

    logger.info("getEquipmentDetails request completed successfully", {
      accountId,
      equipmentId,
    });
    sendSuccessResponse(res, details, "Equipment details fetched successfully");
    return;
  } catch (err: unknown) {
    logger.error("getEquipmentDetails request failed", {
      error: err instanceof Error ? err.message : "Unknown error",
      query: req.query,
    });
    return sendErrorResponse(
      res,
      (err as Error).message || "Failed to fetch equipment details data"
    );
  }
};

/**
 * Download Fleet List View
 *
 * Exports fleet data to Excel format with customizable columns and filtering.
 * Supports downloading all data or excluding specific equipment IDs.
 *
 * @param req - Express request object containing body parameters
 * @param req.body.query - Query parameters for filtering data
 * @param req.body.columns - Array of column definitions for Excel export
 * @param res - Express response object
 *
 * @returns Promise<void> - Sends Excel file as attachment
 *
 * @throws {Error} When payload is invalid or service fails
 *
 * @example
 * POST /api/fleet/download
 * Body: {
 *   "query": { "account_ids": [1,2,3], "unitNumber": "ABC123" },
 *   "columns": [{"label": "Unit Number", "field": "unitNumber"}]
 * }
 */
export const downloadListView = async (req: Request, res: Response) => {
  try {
    logger.info("Starting downloadListView request", {
      body: req.body as Record<string, unknown>,
    });
    // Extract and type payload
    const { query: rawQuery, columns } = req.body as {
      query: GetListViewParams;
      columns: ColumnDefinition[];
    };

    // Validate payload
    if (!rawQuery || !columns || !Array.isArray(columns)) {
      logger.error("downloadListView request failed - invalid payload", {
        rawQuery: !!rawQuery,
        columns: !!columns,
        isArray: Array.isArray(columns),
      });
      sendErrorResponse(res, "Invalid request payload", 400);
      return;
    }

    // Only check array if account_ids is an array (skip "all")
    if (
      Array.isArray(rawQuery.account_ids) &&
      rawQuery.account_ids.some((id) => isNaN(id))
    ) {
      logger.error("downloadListView request failed - invalid account IDs", {
        account_ids: rawQuery.account_ids,
      });
      sendErrorResponse(res, "Invalid account IDs in query", 400);
      return;
    }

    // Map query to service params
    const query: GetListViewParams = {
      ...rawQuery,
    };

    const { buffer, filename } = await downloadListViewService({
      query,
      columns,
    });

    logger.info("downloadListView request completed successfully", {
      filename,
      bufferSize: buffer.length,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.status(200).end(buffer);
  } catch (err: unknown) {
    logger.error("downloadListView request failed", {
      error: err instanceof Error ? err.message : "Unknown error",
      body: req.body as Record<string, unknown>,
    });
    return sendErrorResponse(
      res,
      (err as Error).message || "Failed to download list view data"
    );
  }
};

/**
 * Get Telematics Data
 *
 * Retrieves paginated telematics records for a specific unit number.
 * Includes GPS coordinates, motion status, and other telemetry data.
 *
 * @param req - Express request object containing parameters and query
 * @param req.params.unitNumber - Unit number to fetch telematics for (required)
 * @param req.query.page - Page number for pagination (default: 1)
 * @param req.query.perPage - Items per page (default: 10)
 * @param res - Express response object
 *
 * @returns Promise<void> - Sends paginated telematics data or 404 if no records
 *
 * @throws {Error} When unitNumber is missing or pagination parameters are invalid
 *
 * @example
 * GET /api/fleet/telematics/ABC123?page=1&perPage=10
 */
export const getTelematics = async (req: Request, res: Response) => {
  try {
    logger.info("Starting getTelematics request", {
      params: req.params,
      query: req.query,
    });
    const { unitNumber } = req.params;

    if (!unitNumber) {
      logger.error(
        "getTelematics request failed - missing unitNumber parameter",
        {
          params: req.params,
        }
      );
      return sendErrorResponse(res, "unitNumber parameter is required", 400);
    }

    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 10;

    // Validate page and perPage values
    if (page < 1 || perPage < 1) {
      logger.error(
        "getTelematics request failed - invalid pagination parameters",
        {
          page,
          perPage,
        }
      );
      return sendErrorResponse(res, "Invalid page or perPage values", 400);
    }

    const {
      data,
      total,
      page: currentPage,
      perPage: pageSize,
    } = await fetchTelematics(unitNumber, page, perPage);

    if (data.length === 0) {
      logger.error("getTelematics request failed - no records found", {
        unitNumber,
        page,
        perPage,
      });
      return sendErrorResponse(res, "Telematics records not found", 404);
    }

    logger.info("getTelematics request completed successfully", {
      unitNumber,
      total,
      currentPage,
      pageSize,
      dataCount: data.length,
    });

    // Convert total to number to avoid TS bigint error
    sendPaginatedBigIntResponse(res, { data }, total, currentPage, pageSize, {
      statusCode: 200,
      message: "Telematics records fetched successfully",
    });
  } catch (err: unknown) {
    logger.error("getTelematics request failed", {
      error: err instanceof Error ? err.message : "Unknown error",
      params: req.params,
      query: req.query,
    });
    return sendErrorResponse(
      res,
      (err as Error).message || "Failed to fetch telematics data"
    );
  }
};

/**
 * Get Equipment Gate Inspections
 *
 * Retrieves paginated gate inspection records for a specific equipment ID.
 * Includes inspection details, location, direction, reason, and attachments.
 * Supports sorting by inspection_date, location, direction, reason, or created_at.
 *
 * @param req - Express request object containing query parameters
 * @param req.query.equipment_id - Equipment ID (required)
 * @param req.query.page - Page number for pagination (default: 1)
 * @param req.query.perPage - Items per page (default: 10)
 * @param req.query.sort - Sorting field and direction (e.g., "inspection_date:desc")
 * @param res - Express response object
 *
 * @returns Promise<void> - Sends paginated gate inspection data or 404 if no records
 *
 * @throws {Error} When equipment_id is missing or pagination parameters are invalid
 *
 * @example
 * GET /api/fleet/gate-inspections?equipment_id=123&page=1&perPage=10&sort=inspection_date:desc
 */
export const getEquipmentGateInspections = async (
  req: Request,
  res: Response
) => {
  try {
    // Extract and validate parameters
    const equipmentId = Number(req.query.equipment_id);
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 10;
    const sort = req.query.sort as string;

    // Validate equipment_id
    if (isNaN(equipmentId)) {
      return sendErrorResponse(
        res,
        "Valid equipment_id parameter is required",
        400
      );
    }

    // Validate pagination
    if (page < 1 || perPage < 1 || perPage > 100) {
      return sendErrorResponse(res, "Invalid pagination parameters", 400);
    }

    // Fetch data
    const result = await getEquipmentGateInspectionsService(
      equipmentId,
      page,
      perPage,
      sort
    );

    // Return response
    sendPaginatedBigIntResponse(
      res,
      { data: result.data },
      result.total,
      result.page,
      result.perPage
    );
  } catch (err: unknown) {
    logger.error("getEquipmentGateInspections request failed", {
      error: err instanceof Error ? err.message : "Unknown error",
      query: req.query,
    });
    return sendErrorResponse(
      res,
      (err as Error).message || "Failed to fetch gate inspection data"
    );
  }
};
