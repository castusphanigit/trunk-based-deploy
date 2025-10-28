/**
 * ERS Controller
 *
 * Handles HTTP requests for Emergency Roadside Service (ERS) operations including:
 * - Fetching ERS records with filtering and pagination
 * - Managing ERS details with attachments and communication logs
 * - Excel export functionality for ERS data
 * - Complex filtering by account, equipment, location, and status
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
  getERSDetailsService,
  getERSService,
  downloadERSService,
} from "../../services/ers.service";
import {
  sendErrorResponse,
  sendPaginatedResponse,
  sendPaginatedBigIntResponse,
} from "../../utils/responseUtils";
import { ColumnDefinition } from "../../types/common/request.types";
import logger from "../../utils/logger";

import { GetERSParams } from "../../types/dtos/ers.dto";

/**
 * GET /api/ers - Fetches ERS records with filtering and pagination
 * 
 * Query Parameters:
 * - account_id: Account ID(s) as JSON array or comma-separated string
 * - ers_id: ERS ID for specific record lookup
 * - ers_ref_id: ERS reference ID for filtering
 * - equipment_id: Equipment ID for filtering
 * - unit_number: Unit number for filtering
 * - customer_unit_number: Customer unit number for filtering
 * - location: Location for filtering
 * - created_at: Creation date for filtering
 * - ers_eta: ERS ETA date for filtering
 * - ers_service_level: Service level for filtering
 * - ers_status: ERS status for filtering
 * - hide_completed: Boolean to hide completed records
 * - completed: Boolean to show only completed records
 * - event_type: Event type for filtering
 * - account_number: Account number for filtering
 * - account_name: Account name for filtering
 * - account: Account name or number for filtering
 * - vmrs_code: VMRS code for filtering
 * - page: Page number for pagination
 * - perPage: Number of records per page
 * - sort: Sorting configuration
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @returns Paginated ERS data or error response
 */
export const getERS = async (req: Request, res: Response) => {
  try {
    logger.info("Starting getERS request", { query: req.query });
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
    const { data, total, page, perPage } = await getERSService({
      ...req.query,
      account_ids,
    });

    logger.info("getERS request completed successfully", { 
      total, 
      page, 
      perPage, 
      dataCount: data.length 
    });

    sendPaginatedResponse(res, data, total, page, perPage);
    return;
  } catch (err: unknown) {
    logger.error("getERS request failed", { 
      error: err instanceof Error ? err.message : 'Unknown error',
      query: req.query 
    });
    return sendErrorResponse(
      res,
      (err as Error).message || "Failed to fetch ers data"
    );
  }
};

/**
 * GET /api/ers/details - Fetches detailed ERS information
 * 
 * Query Parameters:
 * - page: Page number for pagination (default: 1)
 * - perPage: Number of records per page (default: 10)
 * - account_id: Account ID for filtering
 * - equipment_id: Equipment ID for filtering
 * - ers_id: ERS ID for specific record lookup
 * 
 * Returns detailed ERS information including:
 * - Service request details
 * - Equipment and account references
 * - Communication logs
 * - File attachments
 * - Parts used information
 * - User audit information
 * 
 * @param req - Express request object
 * @param res - Express response object
 * @returns Detailed ERS data or error response
 */
export const getERSDetailsController = async (req: Request, res: Response) => {
  try {
    logger.info("Starting getERSDetailsController request", { query: req.query });
    const { page, perPage, account_id, equipment_id, ers_id } = req.query;

    const result = await getERSDetailsService({
      page: page ? Number(page) : 1,
      perPage: perPage ? Number(perPage) : 10,
      account_id: account_id ? Number(account_id) : undefined,
      equipment_id: equipment_id ? Number(equipment_id) : undefined,
      ers_id: ers_id ? Number(ers_id) : undefined,
    });

    // Convert all numeric fields to number explicitly
    const totalNum = result.total;
    const pageNum = result.page;
    const perPageNum = result.perPage;

    logger.info("getERSDetailsController request completed successfully", { 
      total: totalNum, 
      page: pageNum, 
      perPage: perPageNum, 
      dataCount: result.data.length 
    });

    sendPaginatedBigIntResponse(
      res,
      result.data,
      totalNum,
      pageNum,
      perPageNum,
      {
        statusCode: 200,
        message: "ERS details fetched successfully"
      }
    );
    return;
  } catch (err: unknown) {
    logger.error("getERSDetailsController request failed", { 
      error: err instanceof Error ? err.message : 'Unknown error',
      query: req.query 
    });
    return sendErrorResponse(
      res,
      (err as Error).message || "Failed to fetch ers details"
    );
  }
};

/**
 * POST /api/ers/download - Exports ERS data to Excel format
 * 
 * Request Body:
 * - query: GetERSParams object with filtering options
 * - columns: Array of column definitions with label, field, and optional maxWidth
 * 
 * Features:
 * - Supports all ERS filtering options
 * - Custom column selection and formatting
 * - Date formatting for Excel compatibility
 * - Handles large datasets efficiently
 * - Generates timestamped filenames
 * - Returns Excel file as download
 * 
 * Security:
 * - Validates request payload structure
 * - Validates account IDs for proper format
 * - Rate limiting should be applied to prevent abuse
 * 
 * @param req - Express request object with query and columns in body
 * @param res - Express response object for file download
 * @returns Excel file download or error response
 */
export const downloadErs = async (req: Request, res: Response) => {
  try {
    logger.info("Starting downloadErs request");
    // Extract and type payload
    const { query: rawQuery, columns } = req.body as {
      query: GetERSParams,
      columns: ColumnDefinition[]
    };

    // Validate payload
    if (!rawQuery || !columns || !Array.isArray(columns)) {
      logger.error("downloadErs request failed - invalid payload", { 
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
      logger.error("downloadErs request failed - invalid account IDs", { 
        account_ids: rawQuery.account_ids 
      });
      sendErrorResponse(res, "Invalid account IDs in query", 400);
      return;
    }

    // Map query to service params
    const query: GetERSParams = {
      ...rawQuery,
    };

    // Call service to get XLSX buffer
    const { buffer, filename } = await downloadERSService({ query, columns });

    logger.info("downloadErs request completed successfully", { 
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
    logger.error("downloadErs request failed", { 
      error: err instanceof Error ? err.message : 'Unknown error'
    });
    return sendErrorResponse(
      res,
      (err as Error).message || "Failed to download ers data"
    );
  }
};
