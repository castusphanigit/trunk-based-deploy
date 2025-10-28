/**
 * Agreement Controller
 *
 * Handles HTTP requests for agreement-related operations including:
 * - Fetching lease and rental agreements with filtering and pagination
 * - Managing agreement details and equipment assignments
 * - Excel export functionality for agreements
 * - Data validation and error handling
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
  getLeaseAgreementDetailsService,
  getLeaseAgreementsService,
  getRentalAgreementsService,
  downloadRentalAgreementsService,
  downloadLeaseAgreementsService,
} from "../../services/agreement.service";
import {
  sendPaginatedBigIntResponse,
  sendErrorResponse,
} from "../../utils/responseUtils";
import logger from "../../utils/logger";

import {
  GetLeaseAgreementsParams,
  RequestedColumn,
  AgreementRowKey,
} from "../../types/dtos/agreement.dto";

// Constants for validation
const VALIDATION_CONSTANTS = {
  HTTP_STATUS: {
    BAD_REQUEST: 400,
    NOT_FOUND: 404,
    INTERNAL_SERVER_ERROR: 500,
  },
} as const;
/**
 * Runtime type guard to validate AgreementRowKey values
 * Ensures only valid field names are used for column mapping
 *
 * @param key - The string to validate as an AgreementRowKey
 * @returns True if the key is a valid AgreementRowKey, false otherwise
 */
const isAgreementRowKey = (key: string): key is AgreementRowKey => {
  return [
    "sno",
    "equipment_id",
    "unit_number",
    "description",
    "schedule_agreement_id",
    "agreement_type",
    "account_number",
    "account_name",
    "lease_po",
    "contract_created_at",
    "status",
    "start_date",
    "termination_date",
    "facility",
  ].includes(key);
};

/**
 * Helper function to parse account IDs from query parameter
 * @param accountIdParam - The account_id parameter from query
 * @returns Array of valid account IDs
 */
const parseAccountIds = (accountIdParam: string): number[] => {
  try {
    // Try parsing as JSON array first
    const parsed = JSON.parse(accountIdParam) as (string | number)[];
    if (Array.isArray(parsed)) {
      return parsed
        .map((id) => (typeof id === "number" ? id : Number(id)))
        .filter((id): id is number => !isNaN(id));
    }
  } catch {
    // Fallback: comma-separated string
    return accountIdParam
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id): id is number => !isNaN(id));
  }
  return [];
};

/**
 * Helper function to validate account IDs
 * @param accountIds - Array of account IDs to validate
 * @param res - Express response object
 * @param context - Context for error logging
 * @returns True if valid, false if invalid (response already sent)
 */
const validateAccountIds = (
  accountIds: number[],
  res: Response,
  context: string
): boolean => {
  if (accountIds.length === 0) {
    logger.error(`${context} failed: No valid account_ids provided`);
    sendErrorResponse(
      res,
      "No valid account_ids provided",
      VALIDATION_CONSTANTS.HTTP_STATUS.BAD_REQUEST
    );
    return false;
  }
  return true;
};

/**
 * Helper function to handle common error responses
 * @param error - The error object
 * @param res - Express response object
 * @param context - Additional context for logging
 * @returns Express response
 */
const handleError = (
  error: unknown,
  res: Response,
  context: string
): Response => {
  logger.error(`${context} failed with error`, {
    error: (error as Error).message,
    stack: (error as Error).stack,
  });
  return sendErrorResponse(
    res,
    (error as Error).message || `Failed to ${context.toLowerCase()}`
  );
};

/**
 * GET /api/agreements/lease
 *
 * Fetches lease agreements with filtering, sorting, and pagination
 *
 * @param req - Express request object containing query parameters
 * @param req.query.account_id - Required. Account IDs as JSON array or comma-separated string
 * @param req.query.page - Optional. Page number for pagination (default: 1)
 * @param req.query.perPage - Optional. Items per page (default: 10)
 * @param req.query.sort - Optional. Sort field and direction (e.g., "account_number:asc")
 * @param req.query.unit_number - Optional. Filter by unit number
 * @param req.query.description - Optional. Filter by equipment description
 * @param req.query.status - Optional. Filter by agreement status
 * @param req.query.facility - Optional. Filter by facility code
 * @param req.query.agreement_type - Optional. Filter by agreement type
 * @param req.query.contract_start_date - Optional. Filter by contract start date
 * @param req.query.contract_end_date - Optional. Filter by contract end date
 * @param res - Express response object
 *
 * @returns JSON response with paginated lease agreement data
 *
 * @throws {400} When account_id parameter is missing or invalid
 * @throws {500} When service call fails
 *
 * @example
 * GET /api/agreements/lease?account_id=[1,2,3]&page=1&perPage=10&sort=account_number:asc
 */
export const getLeaseAgreements = async (req: Request, res: Response) => {
  try {
    logger.info("Starting getLeaseAgreements API call", { query: req.query });

    if (!req.query.account_id) {
      logger.error(
        "getLeaseAgreements failed: account_id parameter is required"
      );
      return sendErrorResponse(
        res,
        "account_id parameter is required",
        VALIDATION_CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const account_ids = parseAccountIds(req.query.account_id as string);
    if (!validateAccountIds(account_ids, res, "getLeaseAgreements")) {
      return;
    }

    logger.info("Calling getLeaseAgreementsService", { account_ids });
    const { data, total, page, perPage } = await getLeaseAgreementsService({
      ...req.query,
      account_ids,
    });

    logger.info("getLeaseAgreements completed successfully", {
      total,
      page,
      perPage,
      dataCount: data.length,
    });
    sendPaginatedBigIntResponse(res, { data }, total, page, perPage, {
      statusCode: 200,
      message: "Lease agreements fetched successfully",
    });
    return;
  } catch (err: unknown) {
    return handleError(err, res, "getLeaseAgreements");
  }
};

/**
 * GET /api/agreements/rental
 *
 * Fetches rental agreements with filtering, sorting, and pagination
 *
 * @param req - Express request object containing query parameters
 * @param req.query.account_id - Required. Account IDs as JSON array or comma-separated string
 * @param req.query.page - Optional. Page number for pagination (default: 1)
 * @param req.query.perPage - Optional. Items per page (default: 10)
 * @param req.query.sort - Optional. Sort field and direction (e.g., "account_number:asc")
 * @param req.query.unit_number - Optional. Filter by unit number
 * @param req.query.description - Optional. Filter by equipment description
 * @param req.query.status - Optional. Filter by agreement status
 * @param req.query.facility - Optional. Filter by facility code
 * @param req.query.agreement_type - Optional. Filter by agreement type
 * @param req.query.contract_start_date - Optional. Filter by contract start date
 * @param req.query.contract_end_date - Optional. Filter by contract end date
 * @param res - Express response object
 *
 * @returns JSON response with paginated rental agreement data
 *
 * @throws {400} When account_id parameter is missing or invalid
 * @throws {500} When service call fails
 *
 * @example
 * GET /api/agreements/rental?account_id=[1,2,3]&page=1&perPage=10&sort=account_number:asc
 */
export const getRentalAgreements = async (req: Request, res: Response) => {
  try {
    logger.info("Starting getRentalAgreements API call", { query: req.query });

    if (!req.query.account_id) {
      logger.error(
        "getRentalAgreements failed: account_id parameter is required"
      );
      return sendErrorResponse(
        res,
        "account_id parameter is required",
        VALIDATION_CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    const account_ids = parseAccountIds(req.query.account_id as string);
    if (!validateAccountIds(account_ids, res, "getRentalAgreements")) {
      return;
    }

    logger.info("Calling getRentalAgreementsService", { account_ids });
    const { data, total, page, perPage } = await getRentalAgreementsService({
      ...req.query,
      account_ids,
    });

    logger.info("getRentalAgreements completed successfully", {
      total,
      page,
      perPage,
      dataCount: data.length,
    });
    sendPaginatedBigIntResponse(res, { data }, total, page, perPage, {
      statusCode: 200,
      message: "Rental agreements fetched successfully",
    });
    return;
  } catch (err: unknown) {
    return handleError(err, res, "getRentalAgreements");
  }
};

/**
 * GET /api/agreements/lease/:schedule_agreement_id/:equipment_id
 *
 * Fetches detailed information for a specific lease agreement and equipment
 *
 * @param req - Express request object containing route parameters
 * @param req.params.schedule_agreement_id - Required. The unique identifier for the schedule agreement
 * @param req.params.equipment_id - Required. The unique identifier for the equipment
 * @param res - Express response object
 *
 * @returns JSON response with detailed agreement information
 *
 * @throws {400} When required parameters are missing or invalid
 * @throws {404} When agreement or equipment not found
 * @throws {500} When service call fails
 *
 * @example
 * GET /api/agreements/lease/123/456
 */
export const getLeaseAgreementDetails = async (req: Request, res: Response) => {
  try {
    logger.info("Starting getLeaseAgreementDetails API call", {
      params: req.params,
      query: req.query,
    });
    const id = Number(req.params.schedule_agreement_id);
    const equipmentid = Number(req.params.equipment_id);
    if (!id) {
      logger.error("getLeaseAgreementDetails failed: ID required");
      return res
        .status(VALIDATION_CONSTANTS.HTTP_STATUS.BAD_REQUEST)
        .json({ message: "ID required" });
    }

    // Parse invoice-related query parameters
    const includeInvoiceHistory = req.query.includeInvoiceHistory === "true";
    const invoiceQuery = includeInvoiceHistory
      ? {
          page: req.query.invoicePage ? Number(req.query.invoicePage) : 1,
          perPage: req.query.invoicePerPage
            ? Number(req.query.invoicePerPage)
            : 10,
          sort: req.query.invoiceSort as string,
          status: req.query.invoiceStatus as string,
          invoiceType: req.query.invoiceType as string,
          dateFrom: req.query.invoiceDateFrom as string,
          dateTo: req.query.invoiceDateTo as string,
        }
      : undefined;

    logger.info("Calling getLeaseAgreementDetailsService", {
      id,
      equipmentid,
      includeInvoiceHistory,
      invoiceQuery,
    });
    const data = await getLeaseAgreementDetailsService(
      id,
      equipmentid,
      includeInvoiceHistory,
      invoiceQuery
    );
    if (!data) {
      logger.error("getLeaseAgreementDetails failed: Agreement not found", {
        id,
        equipmentid,
      });
      return res
        .status(VALIDATION_CONSTANTS.HTTP_STATUS.NOT_FOUND)
        .json({ message: "Agreement not found" });
    }

    logger.info("getLeaseAgreementDetails completed successfully", {
      id,
      equipmentid,
    });
    return res
      .status(200)
      .json({ data, message: "Agreement details fetched successfully" });
  } catch (err: unknown) {
    return handleError(err, res, "getLeaseAgreementDetails");
  }
};

/**
 * POST /api/agreements/rental/download
 *
 * Downloads rental agreements as an Excel file with custom column configuration
 *
 * @param req - Express request object containing request body
 * @param req.body.query - Required. Query parameters for filtering agreements
 * @param req.body.query.account_ids - Required. Account IDs array or "all"
 * @param req.body.query.downloadAll - Optional. Flag to download all data
 * @param req.body.query.equipment_id - Optional. Array of equipment IDs to exclude
 * @param req.body.query.unit_number - Optional. Filter by unit number
 * @param req.body.query.description - Optional. Filter by equipment description
 * @param req.body.query.status - Optional. Filter by agreement status
 * @param req.body.query.facility - Optional. Filter by facility code
 * @param req.body.query.agreement_type - Optional. Filter by agreement type
 * @param req.body.query.contract_start_date - Optional. Filter by contract start date
 * @param req.body.query.contract_end_date - Optional. Filter by contract end date
 * @param req.body.query.sort - Optional. Sort field and direction
 * @param req.body.columns - Required. Array of column definitions for Excel export
 * @param req.body.columns[].label - Column header label
 * @param req.body.columns[].field - Field name to map data from
 * @param req.body.columns[].maxWidth - Optional. Maximum column width
 * @param res - Express response object
 *
 * @returns Excel file download with rental agreements data
 *
 * @throws {400} When request payload is invalid or missing required fields
 * @throws {500} When data processing or Excel generation fails
 *
 * @example
 * POST /api/agreements/rental/download
 * Body: {
 *   "query": { "account_ids": [1, 2, 3], "status": "active" },
 *   "columns": [
 *     { "label": "Unit Number", "field": "unit_number", "maxWidth": 20 },
 *     { "label": "Account", "field": "account_name", "maxWidth": 30 }
 *   ]
 * }
 */
export const downloadRentalAgreements = async (req: Request, res: Response) => {
  try {
    const body = req.body as { query?: unknown; columns?: unknown[] };
    logger.info("Starting downloadRentalAgreements API call", {
      body: {
        hasQuery: !!body?.query,
        hasColumns: !!body?.columns,
        columnsCount: Array.isArray(body?.columns) ? body.columns.length : 0,
      },
    });
    // Extract and type payload
    const { query: rawQuery, columns } = req.body as {
      query: GetLeaseAgreementsParams;
      columns: { label: string; field: string; maxWidth?: number }[];
    };

    // Validate payload
    const hasValidQuery = Boolean(rawQuery);
    const hasValidColumns = Boolean(columns) && Array.isArray(columns);

    if (!hasValidQuery || !hasValidColumns) {
      logger.error("downloadRentalAgreements failed: Invalid request payload");
      sendErrorResponse(
        res,
        "Invalid request payload",
        VALIDATION_CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
      return;
    }

    // --- Validate mandatory account_ids ---
    if (
      !rawQuery.account_ids ||
      (Array.isArray(rawQuery.account_ids) &&
        rawQuery.account_ids.length === 0) ||
      (typeof rawQuery.account_ids === "string" &&
        rawQuery.account_ids.trim() === "")
    ) {
      logger.error(
        "downloadRentalAgreements failed: account_ids parameter is required"
      );
      return sendErrorResponse(
        res,
        "account_ids parameter is required",
        VALIDATION_CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Only check array if account_ids is an array (skip "all")
    if (
      Array.isArray(rawQuery.account_ids) &&
      rawQuery.account_ids.some((id) => isNaN(id))
    ) {
      logger.error(
        "downloadRentalAgreements failed: Invalid account IDs in query"
      );
      sendErrorResponse(
        res,
        "Invalid account IDs in query",
        VALIDATION_CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
      return;
    }

    // Map query to service params
    const query: GetLeaseAgreementsParams = { ...rawQuery };

    // Validate and convert ColumnDefinition[] -> RequestedColumn[]
    const requestedColumns: RequestedColumn[] = columns
      .filter((col) => isAgreementRowKey(col.field))
      .map((col) => ({
        label: col.label,
        field: col.field as AgreementRowKey,
        maxWidth: col.maxWidth,
      }));

    if (requestedColumns.length === 0) {
      logger.error(
        "downloadRentalAgreements failed: No valid columns provided"
      );
      sendErrorResponse(
        res,
        "No valid columns provided",
        VALIDATION_CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
      return;
    }

    logger.info("Calling downloadRentalAgreementsService", {
      account_ids: query.account_ids,
      columnsCount: requestedColumns.length,
    });
    const { buffer, filename } = await downloadRentalAgreementsService({
      query,
      columns: requestedColumns,
    });

    logger.info("downloadRentalAgreements completed successfully", {
      filename,
    });
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    return res.send(buffer);
  } catch (err: unknown) {
    return handleError(err, res, "downloadRentalAgreements");
  }
};

/**
 * POST /api/agreements/lease/download
 *
 * Downloads lease agreements as an Excel file with custom column configuration
 *
 * @param req - Express request object containing request body
 * @param req.body.query - Required. Query parameters for filtering agreements
 * @param req.body.query.account_ids - Required. Account IDs array or "all"
 * @param req.body.query.downloadAll - Optional. Flag to download all data
 * @param req.body.query.equipment_id - Optional. Array of equipment IDs to exclude
 * @param req.body.query.unit_number - Optional. Filter by unit number
 * @param req.body.query.description - Optional. Filter by equipment description
 * @param req.body.query.status - Optional. Filter by agreement status
 * @param req.body.query.facility - Optional. Filter by facility code
 * @param req.body.query.agreement_type - Optional. Filter by agreement type
 * @param req.body.query.contract_start_date - Optional. Filter by contract start date
 * @param req.body.query.contract_end_date - Optional. Filter by contract end date
 * @param req.body.query.sort - Optional. Sort field and direction
 * @param req.body.columns - Required. Array of column definitions for Excel export
 * @param req.body.columns[].label - Column header label
 * @param req.body.columns[].field - Field name to map data from
 * @param req.body.columns[].maxWidth - Optional. Maximum column width
 * @param res - Express response object
 *
 * @returns Excel file download with lease agreements data
 *
 * @throws {400} When request payload is invalid or missing required fields
 * @throws {500} When data processing or Excel generation fails
 *
 * @example
 * POST /api/agreements/lease/download
 * Body: {
 *   "query": { "account_ids": [1, 2, 3], "contract_panel_type": "L" },
 *   "columns": [
 *     { "label": "Unit Number", "field": "unit_number", "maxWidth": 20 },
 *     { "label": "Account", "field": "account_name", "maxWidth": 30 }
 *   ]
 * }
 */
export const downloadLeaseAgreements = async (req: Request, res: Response) => {
  try {
    const body = req.body as { query?: unknown; columns?: unknown[] };
    logger.info("Starting downloadLeaseAgreements API call", {
      body: {
        hasQuery: !!body?.query,
        hasColumns: !!body?.columns,
        columnsCount: Array.isArray(body?.columns) ? body.columns.length : 0,
      },
    });
    // Extract and type payload
    const { query: rawQuery, columns } = req.body as {
      query: GetLeaseAgreementsParams;
      columns: { label: string; field: string; maxWidth?: number }[];
    };

    // Validate payload
    const hasValidQuery = Boolean(rawQuery);
    const hasValidColumns = Boolean(columns) && Array.isArray(columns);

    if (!hasValidQuery || !hasValidColumns) {
      logger.error("downloadLeaseAgreements failed: Invalid request payload");
      sendErrorResponse(
        res,
        "Invalid request payload",
        VALIDATION_CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
      return;
    }

    // --- Validate mandatory account_ids ---
    if (
      !rawQuery.account_ids ||
      (Array.isArray(rawQuery.account_ids) &&
        rawQuery.account_ids.length === 0) ||
      (typeof rawQuery.account_ids === "string" &&
        rawQuery.account_ids.trim() === "")
    ) {
      logger.error(
        "downloadLeaseAgreements failed: account_ids parameter is required"
      );
      return sendErrorResponse(
        res,
        "account_ids parameter is required",
        VALIDATION_CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
    }

    // Only check array if account_ids is an array (skip "all")
    if (
      Array.isArray(rawQuery.account_ids) &&
      rawQuery.account_ids.some((id) => isNaN(id))
    ) {
      logger.error(
        "downloadLeaseAgreements failed: Invalid account IDs in query"
      );
      sendErrorResponse(
        res,
        "Invalid account IDs in query",
        VALIDATION_CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
      return;
    }

    // Map query to service params
    const query: GetLeaseAgreementsParams = { ...rawQuery };

    // Validate and convert ColumnDefinition[] -> RequestedColumn[]
    const requestedColumns: RequestedColumn[] = columns
      .filter((col) => isAgreementRowKey(col.field))
      .map((col) => ({
        label: col.label,
        field: col.field as AgreementRowKey,
        maxWidth: col.maxWidth,
      }));

    if (requestedColumns.length === 0) {
      logger.error("downloadLeaseAgreements failed: No valid columns provided");
      sendErrorResponse(
        res,
        "No valid columns provided",
        VALIDATION_CONSTANTS.HTTP_STATUS.BAD_REQUEST
      );
      return;
    }

    logger.info("Calling downloadLeaseAgreementsService", {
      account_ids: query.account_ids,
      columnsCount: requestedColumns.length,
    });
    const { buffer, filename } = await downloadLeaseAgreementsService({
      query,
      columns: requestedColumns,
    });

    logger.info("downloadLeaseAgreements completed successfully", { filename });
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    return res.send(buffer);
  } catch (err: unknown) {
    return handleError(err, res, "downloadLeaseAgreements");
  }
};
