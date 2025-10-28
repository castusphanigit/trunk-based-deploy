/**
 * Workorder Controller
 *
 * Handles HTTP requests for workorder-related operations including:
 * - Fetching workorders with advanced filtering and pagination
 * - Workorder history retrieval
 * - Detailed workorder information with attachments and VMRS codes
 * - Excel export functionality with custom column mapping
 *
 * Security considerations:
 * - All endpoints require proper authentication
 * - Input validation and sanitization
 * - Authorization checks for data access
 * - Rate limiting on export operations
 * - BigInt serialization handling for database responses
 *
 * @author Rajeswari
 * @version 1.0.0
 */

import { Request, Response } from "express";
import {
  getWorkordersService,
  getWorkordersHistoryService,
  getWorkorderDetailsService,
  downloadWorkordersService,
} from "../../services/workorder.service";
import {
  sendErrorResponse,
  sendPaginatedResponse,
} from "../../utils/responseUtils";
import {
  GetWorkordersParams,
  DownloadQuery,
} from "../../types/dtos/workorder.dto";
import { ColumnDefinition } from "../../types/common/request.types";
import logger from "../../utils/logger";

/**
 * GET /api/workorders
 * 
 * Retrieves workorders with comprehensive filtering and pagination support.
 * Supports filtering by account IDs, workorder status, equipment, technician,
 * dates, and various other criteria. Includes VMRS codes integration.
 * 
 * Query Parameters:
 * - account_id: Account ID(s) as JSON array or comma-separated string
 * - workorder_id: Specific workorder ID
 * - equipment_id: Equipment ID filter
 * - technician_name: Technician name filter (case-insensitive)
 * - workorder_status: Workorder status filter
 * - priority_start: Priority start date filter
 * - priority_end: Priority end date filter
 * - priority_range: Priority date range filter (formatted string)
 * - assigned_date: Assigned date filter
 * - workorder_ref_id: Workorder reference ID filter
 * - workorder_eta: Workorder ETA filter
 * - unit_number: Unit number filter
 * - customer_unit_number: Customer unit number filter
 * - account_number: Account number filter
 * - account_name: Account name filter
 * - account: General account filter (searches both number and name)
 * - vmrs_code: VMRS code filter (case-insensitive)
 * - page: Page number for pagination (default: 1)
 * - perPage: Items per page (default: 10)
 * - sort: Sorting configuration
 * 
 * @param req - Express request object
 * @param res - Express response object
 * 
 * @returns Paginated workorder data with computed fields
 * 
 * @example
 * ```typescript
 * // GET /api/workorders?account_id=[1,2,3]&workorder_status=OPEN&page=1&perPage=10
 * ```
 */
export const getWorkorders = async (req: Request, res: Response) => {
  try {
    logger.info("Starting getWorkorders request", { query: req.query });
    let account_ids: number[] = [];

    if (req.query.account_id) {
      const raw = req.query.account_id as string;

      // Try parsing as JSON array first
      try {
        const parsed = JSON.parse(raw) as (string | number)[];
        if (Array.isArray(parsed)) {
          account_ids = parsed
            .map((id) => (typeof id === "number" ? id : Number(id)))
            .filter((id): id is number => !isNaN(id));
        }
      } catch {
        // Fallback: comma-separated string
        account_ids = raw
          .split(",")
          .map((id) => Number(id.trim()))
          .filter((id): id is number => !isNaN(id));
      }
    }

    // Pagination
    const page = req.query.page ? Number(req.query.page as string) : 1;
    const perPage = req.query.perPage
      ? Number(req.query.perPage as string)
      : 10;

    const { data, total } = await getWorkordersService({
      ...req.query,
      account_ids,
      page,
      perPage,
    });

    logger.info("getWorkorders request completed successfully", { 
      total, 
      page, 
      perPage, 
      dataCount: data.length 
    });

    sendPaginatedResponse(res, data, total, page, perPage, 200);
    return;
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch workoder data";

    logger.error("getWorkorders request failed", { 
      error: message,
      query: req.query 
    });

    sendErrorResponse(res, message, 500);
    return;
  }
};
/**
 * GET /api/workorders/history
 * 
 * Retrieves workorder history with filtering and pagination support.
 * Specialized endpoint for historical workorder data without VMRS codes.
 * Optimized for equipment-specific history queries.
 * 
 * Query Parameters:
 * - equipment_id: Equipment ID filter (required for equipment history)
 * - workorder_id: Specific workorder ID
 * - technician_name: Technician name filter (case-insensitive)
 * - workorder_status: Workorder status filter
 * - priority_start: Priority start date filter
 * - priority_end: Priority end date filter
 * - priority_range: Priority date range filter (formatted string)
 * - assigned_date: Assigned date filter
 * - workorder_ref_id: Workorder reference ID filter
 * - workorder_eta: Workorder ETA filter
 * - unit_number: Unit number filter
 * - customer_unit_number: Customer unit number filter
 * - account_number: Account number filter
 * - account_name: Account name filter
 * - account: General account filter (searches both number and name)
 * - page: Page number for pagination (default: 1)
 * - perPage: Items per page (default: 10)
 * - sort: Sorting configuration
 * 
 * @param req - Express request object
 * @param res - Express response object
 * 
 * @returns Paginated workorder history data
 * 
 * @example
 * ```typescript
 * // GET /api/workorders/history?equipment_id=123&workorder_status=COMPLETED&page=1&perPage=20
 * ```
 */
export const getWorkordersHistory = async (req: Request, res: Response) => {
  try {
    logger.info("Starting getWorkordersHistory request", { query: req.query });
    const equipment_id = req.query.equipment_id as string | undefined;

    const page = req.query.page ? Number(req.query.page) : 1;
    const perPage = req.query.perPage ? Number(req.query.perPage) : 10;

    const { data, total, message } = await getWorkordersHistoryService({
      ...req.query,
      equipment_id,
      page,
      perPage,
    });

    logger.info("getWorkordersHistory request completed successfully", { 
      total, 
      page, 
      perPage, 
      dataCount: data.length,
      equipment_id 
    });

    return sendPaginatedResponse(res, data, total, page, perPage, 200, {message});
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch workorders";
    
    logger.error("getWorkordersHistory request failed", { 
      error: message,
      query: req.query 
    });
    
    return sendErrorResponse(res, message, 500);
  }
};

/**
 * GET /api/workorders/details
 * 
 * Retrieves detailed workorder information including attachments, VMRS codes,
 * creator details, and related service request data. Provides comprehensive
 * workorder information for detailed views.
 * 
 * Query Parameters (all required):
 * - account_id: Account ID (number)
 * - equipment_id: Equipment ID (number)
 * - service_request_id: Service request ID (number)
 * 
 * @param req - Express request object
 * @param res - Express response object
 * 
 * @returns Detailed workorder data with all related information
 * 
 * @example
 * ```typescript
 * // GET /api/workorders/details?account_id=123&equipment_id=456&service_request_id=789
 * ```
 */
export const getWorkorderDetails = async (req: Request, res: Response) => {
  try {
    logger.info("Starting getWorkorderDetails request", { query: req.query });
    const { account_id, equipment_id, service_request_id } = req.query;

    if (!account_id || !equipment_id || !service_request_id) {
      logger.error("getWorkorderDetails request failed - missing required parameters", { 
        account_id: !!account_id, 
        equipment_id: !!equipment_id, 
        service_request_id: !!service_request_id 
      });
      return res.status(400).json({
        success: false,
        message:
          "account_id, equipment_id, and service_request_id are required",
      });
    }

    const data = await getWorkorderDetailsService({
      account_id: Number(account_id),
      equipment_id: Number(equipment_id),
      service_request_id: Number(service_request_id),
    });

    logger.info("getWorkorderDetails request completed successfully", { 
      account_id: Number(account_id),
      equipment_id: Number(equipment_id),
      service_request_id: Number(service_request_id)
    });

    return res.status(200).json({
      success: 200,
      message: "Fetched workorder details successfully",
      data: safeJson(data, replacer),
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch workoder details";

    logger.error("getWorkorderDetails request failed", { 
      error: message,
      query: req.query 
    });

    sendErrorResponse(res, message, 500);
    return;
  }
};

/**
 * POST /api/workorders/download
 * 
 * Generates and downloads Excel file containing workorder data with custom
 * column configuration. Supports dynamic column mapping, filtering, and
 * formatting. Handles large datasets with efficient processing.
 * 
 * Request Body:
 * - query: Filtering parameters for workorder data (GetWorkordersParams)
 * - columns: Array of column definitions for Excel export
 *   - label: Display label for the column
 *   - field: Field name to extract from workorder data
 *   - maxWidth: Optional maximum width for the column
 * 
 * @param req - Express request object with query and columns in body
 * @param res - Express response object (sends Excel file as attachment)
 * 
 * @returns Excel file download with workorder data
 * 
 * @example
 * ```typescript
 * // POST /api/workorders/download
 * // Body: {
 * //   query: { account_ids: [1, 2, 3], workorder_status: 'OPEN' },
 * //   columns: [
 * //     { label: 'Workorder ID', field: 'workorder_id', maxWidth: 15 },
 * //     { label: 'Status', field: 'workorder_status', maxWidth: 20 }
 * //   ]
 * // }
 * ```
 */
export const downloadWorkorders = async (req: Request, res: Response) => {
  try {
    logger.info("Starting downloadWorkorders request");
    // Extract and type payload
    const { query: rawQuery, columns } = req.body as {
      query: DownloadQuery,
      columns: ColumnDefinition[]
    };

    // Validate payload
    if (!rawQuery || !columns || !Array.isArray(columns)) {
      logger.error("downloadWorkorders request failed - invalid payload", { 
        rawQuery: !!rawQuery, 
        columns: !!columns, 
        isArray: Array.isArray(columns) 
      });
      sendErrorResponse(res, "Invalid request payload", 400);
      return;
    }

    // Only check array if account_ids is an array (skip "all")
    if (
      Array.isArray(rawQuery.account_ids) &&
      rawQuery.account_ids.some((id) => isNaN(id))
    ) {
      logger.error("downloadWorkorders request failed - invalid account IDs", { 
        account_ids: rawQuery.account_ids 
      });
      sendErrorResponse(res, "Invalid account IDs in query", 400);
      return;
    }

    // Map query to service params
    const query: GetWorkordersParams = {
      ...rawQuery,
    };

    // service to get XLSX buffer
    const { buffer, filename } = await downloadWorkordersService({
      query,
      columns,
    });

    logger.info("downloadWorkorders request completed successfully", { 
      filename, 
      bufferSize: buffer.length 
    });

    // Set headers for file download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);

    // Send the file
    return res.send(buffer);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Failed to download workorder data";

    logger.error("downloadWorkorders request failed", { 
      error: message
    });

    sendErrorResponse(res, message, 500);
    return;
  }
};

/**
 * BigInt-safe replacer function for JSON serialization
 * 
 * Converts BigInt values to strings during JSON serialization to prevent
 * serialization errors. Used when sending database responses that may contain
 * BigInt values from Prisma.
 * 
 * @param key - Object key (unused)
 * @param value - Value to check for BigInt type
 * @returns String representation of BigInt or original value
 */
function replacer(key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

/**
 * Safely serializes objects containing BigInt values
 * 
 * Performs JSON serialization with BigInt handling to ensure database
 * responses can be safely sent as JSON without serialization errors.
 * 
 * @param input - Object to serialize
 * @param replacerFn - Optional replacer function (defaults to BigInt replacer)
 * @returns Serialized object with BigInt values converted to strings
 * 
 * @example
 * ```typescript
 * const safeData = safeJson(workorderData);
 * res.json({ data: safeData });
 * ```
 */
function safeJson<T>(
  input: T,
  replacerFn?: (key: string, value: unknown) => unknown
): T {
  return JSON.parse(JSON.stringify(input, replacerFn)) as T;
}
