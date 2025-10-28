/**
 * Dashboard Controller
 *
 * Handles HTTP requests for dashboard-related operations including:
 * - Fetching dashboard metrics and KPIs
 * - Managing VMRS (Vehicle Maintenance Reporting Standards) data
 * - Processing maintenance and repair analytics
 * - Generating compliance and performance reports
 *
 * Security considerations:
 * - All endpoints require proper authentication
 * - Input validation and sanitization
 * - Authorization checks for data access
 * - Rate limiting on analytics operations
 *
 * @author Rajeswari
 * @version 1.0.0
 */

import { Request, Response } from "express";
import { DashboardService } from "../../services/dashboard.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
} from "../../utils/responseUtils";
import logger from "../../utils/logger";

/**
 * Controller class for dashboard operations
 * Handles HTTP requests and delegates business logic to DashboardService
 */
export class DashboardController {
  public dashboardService: DashboardService;

  /**
   * Creates a new instance of DashboardController
   * Initializes the dashboard service dependency
   */
  public constructor() {
    this.dashboardService = new DashboardService();
  }

  /**
   * GET /api/dashboard/metrics
   *
   * Fetches comprehensive dashboard metrics for specified accounts
   *
   * @param req - Express request object containing query parameters
   * @param req.query.account_ids - Required. Comma-separated string of account IDs
   * @param res - Express response object
   *
   * @returns JSON response with dashboard metrics including unit counts, work orders, invoices, etc.
   *
   * @throws {400} When account_ids parameter is missing or invalid
   * @throws {500} When service call fails
   *
   * @example
   * GET /api/dashboard/metrics?account_ids=1,2,3
   */
  public getDashboardMetrics = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      logger.info("Starting getDashboardMetrics request", { query: req.query });
      // Strongly type query
      const { account_ids } = req.query as { account_ids?: string };

      if (!account_ids) {
        logger.error(
          "getDashboardMetrics request failed - missing account_ids parameter",
          {
            query: req.query,
          }
        );
        return sendErrorResponse(
          res,
          "account_ids query parameter is required (e.g., ?account_ids=1,2,3)",
          400
        );
      }

      // Parse into number array
      const accountIds = account_ids
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => !isNaN(id));

      if (accountIds.length === 0) {
        logger.error(
          "getDashboardMetrics request failed - invalid account_ids",
          {
            account_ids,
            parsedIds: accountIds,
          }
        );
        return sendErrorResponse(res, "Invalid account_ids provided", 400);
      }

      const result = await this.dashboardService.getDashboardMetrics(
        accountIds
      );

      logger.info("getDashboardMetrics request completed successfully", {
        accountIds,
        resultKeys: Object.keys(result),
      });

      return sendSuccessResponse(res, result, "200");
    } catch (error: unknown) {
      if (error instanceof Error && "statusCode" in error) {
        const err = error as { statusCode: number, message: string };
        logger.error("getDashboardMetrics request failed", {
          error: err.message,
          statusCode: err.statusCode,
          query: req.query,
        });
        return sendErrorResponse(res, err.message, err.statusCode);
      }

      logger.error("getDashboardMetrics request failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        query: req.query,
      });

      const isDevelopment = process.env.NODE_ENV === "development";
      return sendErrorResponse(
        res,
        isDevelopment && error instanceof Error
          ? error.message
          : "Internal server error",
        500
      );
    }
  };

  /**
   * GET /api/dashboard/vmrs-list
   *
   * Fetches the complete VMRS lookup list for dropdowns and selections
   *
   * @param req - Express request object
   * @param res - Express response object
   *
   * @returns JSON response with array of VMRS lookup records
   *
   * @throws {500} When service call fails
   *
   * @example
   * GET /api/dashboard/vmrs-list
   */
  public getVMRSList = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      logger.info("Starting getVMRSList request", { query: req.query });
      const vmrsList = await this.dashboardService.getVmrsLookupList();

      logger.info("getVMRSList request completed successfully", {
        listLength: Array.isArray(vmrsList) ? vmrsList.length : "unknown",
      });

      return sendSuccessResponse(res, vmrsList, "200");
    } catch (error: unknown) {
      if (error instanceof Error && "statusCode" in error) {
        const err = error as { statusCode: number, message: string };
        logger.error("getVMRSList request failed", {
          error: err.message,
          statusCode: err.statusCode,
        });
        return sendErrorResponse(res, err.message, err.statusCode);
      }

      logger.error("getVMRSList request failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return sendErrorResponse(res, "Internal server error", 500);
    }
  };

  /**
   * GET /api/dashboard/quick-links
   *
   * Fetches the list of quick links for dashboard navigation
   *
   * @param req - Express request object
   * @param res - Express response object
   *
   * @returns JSON response with array of quick link records
   *
   * @throws {500} When service call fails
   *
   * @example
   * GET /api/dashboard/quick-links
   */
  public getTenQuickLinksList = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      logger.info("Starting getTenQuickLinksList request", {
        query: req.query,
      });
      const quickLinksList = await this.dashboardService.getTenQuickLinks();

      logger.info("getTenQuickLinksList request completed successfully", {
        listLength: Array.isArray(quickLinksList)
          ? quickLinksList.length
          : "unknown",
      });

      return sendSuccessResponse(res, quickLinksList, "200");
    } catch (error: unknown) {
      if (error instanceof Error && "statusCode" in error) {
        const err = error as { statusCode: number, message: string };
        logger.error("getTenQuickLinksList request failed", {
          error: err.message,
          statusCode: err.statusCode,
        });
        return sendErrorResponse(res, err.message, err.statusCode);
      }

      logger.error("getTenQuickLinksList request failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return sendErrorResponse(res, "Internal server error", 500);
    }
  };

  /**
   * POST /api/dashboard/vmrs-metrics
   *
   * Fetches VMRS (Vehicle Maintenance Reporting Standards) metrics and analytics
   *
   * @param req - Express request object containing request body
   * @param req.body.account_ids - Required. Array of account IDs to fetch metrics for
   * @param req.body.year - Optional. Year to filter data (overrides start_date and end_date)
   * @param req.body.start_date - Optional. Start date for filtering (format: YYYY-MM-DD)
   * @param req.body.end_date - Optional. End date for filtering (format: YYYY-MM-DD)
   * @param req.body.vmrs_codes - Optional. Array of VMRS codes to filter by
   * @param res - Express response object
   *
   * @returns JSON response with VMRS analytics including repair counts, costs, and compliance data
   *
   * @throws {400} When account_ids are missing or invalid
   * @throws {500} When service call fails
   *
   * @example
   * POST /api/dashboard/vmrs-metrics
   * Body: {
   *   "account_ids": [1, 2, 3],
   *   "year": 2024,
   *   "vmrs_codes": [100, 200]
   * }
   */
  public getVmrsMetrics = async (
    req: Request,
    res: Response
  ): Promise<Response> => {
    try {
      logger.info("Starting getVmrsMetrics request");
      const requestData = this.extractVmrsRequestData(req.body as Record<string, unknown>);
      
      const validationResult = this.validateVmrsRequestData(requestData);
      if (!validationResult.isValid) {
        return sendErrorResponse(res, validationResult.error, 400);
      }

      const result = await this.dashboardService.getVmrsMetrics(
        validationResult.accountIds,
        requestData.year,
        validationResult.filters
      );

      logger.info("getVmrsMetrics request completed successfully", {
        accountIds: validationResult.accountIds,
        year: requestData.year,
        filters: validationResult.filters,
        resultKeys: Object.keys(result),
      });

      return sendSuccessResponse(res, result, "200");
    } catch (error: unknown) {
      return this.handleVmrsMetricsError(error, res);
    }
  };

  /**
   * Extracts and validates request data for VMRS metrics
   */
  private extractVmrsRequestData(body: Record<string, unknown>) {
    return {
      account_ids: body.account_ids as number[],
      year: body.year as number | undefined,
      start_date: body.start_date as string | undefined,
      end_date: body.end_date as string | undefined,
      vmrs_codes: body.vmrs_codes as number[] | undefined,
    };
  }

  /**
   * Validates VMRS request data and returns processed data
   */
  private validateVmrsRequestData(data: ReturnType<typeof this.extractVmrsRequestData>) {
    const { account_ids, year, start_date, end_date, vmrs_codes } = data;

    if (!account_ids || !Array.isArray(account_ids) || account_ids.length === 0) {
      logger.error("getVmrsMetrics request failed - missing account_ids", {
        account_ids: !!account_ids,
        isArray: Array.isArray(account_ids),
        length: account_ids?.length,
      });
      return {
        isValid: false,
        error: "account_ids array is required in request body",
        accountIds: [],
        filters: {}
      };
    }

    const accountIds = account_ids.filter(
      (id) => typeof id === "number" && !isNaN(id)
    );
    
    if (accountIds.length === 0) {
      logger.error("getVmrsMetrics request failed - invalid account_ids", {
        account_ids,
        filteredIds: accountIds,
      });
      return {
        isValid: false,
        error: "Invalid account_ids provided",
        accountIds: [],
        filters: {}
      };
    }

    if (year && (typeof year !== "number" || year < 2000 || year > 3000)) {
      logger.error("getVmrsMetrics request failed - invalid year", {
        year,
        type: typeof year,
      });
      return {
        isValid: false,
        error: "Invalid year provided",
        accountIds: [],
        filters: {}
      };
    }

    const filters = {
      start_date,
      end_date,
      vmrs_codes: vmrs_codes?.filter(
        (id) => typeof id === "number" && !isNaN(id)
      ),
    };

    return {
      isValid: true,
      error: "",
      accountIds,
      filters
    };
  }

  /**
   * Handles errors for VMRS metrics requests
   */
  private handleVmrsMetricsError(error: unknown, res: Response): Response {
    if (error instanceof Error && "statusCode" in error) {
      const err = error as { statusCode: number, message: string };
      logger.error("getVmrsMetrics request failed", {
        error: err.message,
        statusCode: err.statusCode,
      });
      return sendErrorResponse(res, err.message, err.statusCode);
    }

    logger.error("getVmrsMetrics request failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    const isDevelopment = process.env.NODE_ENV === "development";
    return sendErrorResponse(
      res,
      isDevelopment && error instanceof Error
        ? error.message
        : "Internal Server Error",
      500
    );
  }
}
