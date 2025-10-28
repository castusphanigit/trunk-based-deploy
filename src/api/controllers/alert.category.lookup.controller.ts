import { Request, Response } from "express";
import { AlertCategoryLookupService } from "../../services/alert.category.lookup.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
} from "../../utils/responseUtils";
import { CreateAlertCategoryRequestDto } from "../../types/dtos/alert.category.lookup.request.dto";
import logger from "../../utils/logger";

const alertCategoryService = new AlertCategoryLookupService();

/**
 * Creates a new alert category lookup entry
 * Validates required category name and creates alert category in the database
 *
 * @param req - Express request object containing alert category data
 * @param res - Express response object
 * @returns Created alert category data or error response
 * @author chaitanya
 */
export const createAlertCategory = async (req: Request, res: Response) => {
  try {
    const dto = req.body as CreateAlertCategoryRequestDto;

    if (!dto.category_name || typeof dto.category_name !== "string") {
      return sendErrorResponse(res, "Invalid or missing category_name", 400);
    }

    const newCategory = await alertCategoryService.createAlertCategory(dto);
    logger.info("Successfully created alert category");
    return sendSuccessResponse(
      res,
      newCategory,
      "Alert Category created successfully"
    );
  } catch (error) {
    logger.error((error as Error).message || "Internal server error", error);
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return sendErrorResponse(res, "Duplicate alert category found", 400);
    }
    return sendErrorResponse(res, "Internal server error");
  }
};

/**
 * Retrieves all alert category lookup entries
 * Fetches all available alert categories from the database
 *
 * @param req - Express request object
 * @param res - Express response object
 * @returns Array of alert categories or error response
 * @author chaitanya
 */
export const getAllAlertCategories = async (req: Request, res: Response) => {
  try {
    const categories = await alertCategoryService.getAllAlertCategories();
    logger.info(
      "Successfully retrieved %d alert categories",
      categories.length
    );
    return sendSuccessResponse(
      res,
      categories,
      "Alert Categories fetched successfully"
    );
  } catch (error) {
    logger.error(
      (error as Error).message || "Failed to fetch alert categories",
      error
    );
    return sendErrorResponse(res, "Failed to fetch alert categories");
  }
};

/**
 * Retrieves alert category by ID
 * Fetches a specific alert category using its unique identifier
 *
 * @param req - Express request object with id parameter
 * @param res - Express response object
 * @returns Alert category data or error response
 * @author chaitanya
 */
export const getAlertCategoryById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return sendErrorResponse(res, "Valid categoryId is required", 400);
    }

    const category = await alertCategoryService.getAlertCategoryById(
      Number(id)
    );

    if (!category) {
      return sendErrorResponse(res, "No alert category found", 404);
    }

    logger.info("Successfully retrieved alert category by ID: %s", id);
    return sendSuccessResponse(
      res,
      category,
      "Alert Category fetched successfully"
    );
  } catch (error) {
    logger.error(
      (error as Error).message || "Failed to fetch alert category by id",
      error
    );
    return sendErrorResponse(res, "Failed to fetch alert category by id");
  }
};
