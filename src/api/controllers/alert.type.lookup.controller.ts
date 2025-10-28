import { Request, Response } from "express";
import { AlertTypeLookupService } from "../../services/alert.type.lookup.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
} from "../../utils/responseUtils";
import { CreateAlertTypeLookupRequestDto } from "../../types/dtos/alert.type.lookup.request.dto";
import logger from "../../utils/logger";

const alertTypeLookupService = new AlertTypeLookupService();

/**
 * Creates a new alert type lookup entry
 * Validates required fields and creates alert type with default values for optional fields
 *
 * @param req - Express request object containing alert type data
 * @param res - Express response object
 * @returns Created alert type data or error response
 * @author chaitanya
 */
export const createAlertType = async (req: Request, res: Response) => {
  try {
    const dto = req.body as Partial<CreateAlertTypeLookupRequestDto>;

    if (!dto.event_name || typeof dto.event_name !== "string") {
      return sendErrorResponse(res, "Invalid or missing event_name", 400);
    }

    if (!dto.operation_type || typeof dto.operation_type !== "string") {
      return sendErrorResponse(res, "Invalid or missing operation_type", 400);
    }

    // Ensure dto is fully typed for the service
    const fullDto: CreateAlertTypeLookupRequestDto = {
      event_name: dto.event_name,
      operation_type: dto.operation_type,
      event_type: dto.event_type ?? "",
      metric_value: dto.metric_value ?? 0,
      status: dto.status ?? "ACTIVE",
      customer_id: dto.customer_id ?? 0,
      alert_category_lookup_id: dto.alert_category_lookup_id ?? 0,
    };

    const newAlertType = await alertTypeLookupService.createAlertType(fullDto);
    logger.info("Successfully created alert type");
    return sendSuccessResponse(
      res,
      newAlertType,
      "Alert type created successfully"
    );
  } catch (error) {
    logger.error((error as Error).message || "Internal server error", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return sendErrorResponse(res, "Duplicate alert type found", 400);
    }
    return sendErrorResponse(res, "Internal server error");
  }
};

/**
 * Retrieves all alert type lookup entries
 * Fetches all available alert types from the database
 *
 * @param req - Express request object
 * @param res - Express response object
 * @returns Array of alert types or error response
 * @author chaitanya
 */
export const getAllAlertTypes = async (req: Request, res: Response) => {
  try {
    const alertTypes = await alertTypeLookupService.getAllAlertTypes();
    logger.info("Successfully retrieved %d alert types", alertTypes.length);
    return sendSuccessResponse(
      res,
      alertTypes,
      "Alert types fetched successfully"
    );
  } catch (error) {
    logger.error(
      (error as Error).message || "Failed to fetch alert types",
      error
    );
    return sendErrorResponse(res, "Failed to fetch alert types");
  }
};

/**
 * Retrieves alert types by category ID
 * Fetches all alert types associated with a specific alert category
 *
 * @param req - Express request object with categoryId parameter
 * @param res - Express response object
 * @returns Array of alert types for the category or error response
 * @author chaitanya
 */
export const getAlertTypesByCategoryId = async (
  req: Request,
  res: Response
) => {
  try {
    const { categoryId } = req.params;

    if (!categoryId || isNaN(Number(categoryId))) {
      return sendErrorResponse(res, "Valid categoryId is required", 400);
    }

    const alertTypes = await alertTypeLookupService.getAlertTypesByCategoryId(
      Number(categoryId)
    );

    if (!alertTypes || alertTypes.length === 0) {
      return sendErrorResponse(
        res,
        "No alert types found for this category",
        404
      );
    }

    logger.info(
      "Successfully retrieved %d alert types for category: %s",
      alertTypes.length,
      categoryId
    );
    return sendSuccessResponse(
      res,
      alertTypes,
      "Alert types fetched successfully"
    );
  } catch (error) {
    logger.error(
      (error as Error).message || "Failed to fetch alert types by category",
      error
    );
    return sendErrorResponse(res, "Failed to fetch alert types by category");
  }
};
