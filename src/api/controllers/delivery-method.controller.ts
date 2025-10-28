// src/api/controllers/delivery-method.controller.ts
import { Request, Response } from "express";
import { DeliveryMethodService } from "../../services/delivery-method.service";
import {
  CreateDeliveryMethodRequestDTO,
  UpdateDeliveryMethodRequestDTO,
  FetchDeliveryMethodsRequestDTO,
  GetDeliveryMethodByIdRequestDTO,
} from "../../types/dtos/delivery-method-request.dto";
import {
  sendSuccessResponse,
  sendErrorResponse,
} from "../../utils/responseUtils";
import logger from "../../utils/logger";

const deliveryMethodService = new DeliveryMethodService();

export const createDeliveryMethod = async (req: Request, res: Response) => {
  try {
    const { method_type, status, created_by } =
      req.body as CreateDeliveryMethodRequestDTO;
    if (!method_type || typeof method_type !== "string") {
      sendErrorResponse(res, "Invalid or missing method_type", 400);
      return;
    }
    const dto: CreateDeliveryMethodRequestDTO = {
      method_type,
      status,
      created_by,
    };
    const newDelivery = await deliveryMethodService.createDeliveryMethod(dto);

    logger.info("Successfully created delivery method");
    sendSuccessResponse(res, newDelivery);
    return;
  } catch (error) {
    logger.error((error as Error).message || "Internal server error", error);
    sendErrorResponse(res, "Internal server error");
    return;
  }
};

export const fetchDeliveryMethods = async (req: Request, res: Response) => {
  try {
    const { method_type, status, created_by } = req.query;
    const dto: FetchDeliveryMethodsRequestDTO = {
      method_type: typeof method_type === "string" ? method_type : undefined,
      status:
        typeof status === "string" ||
        typeof status === "number" ||
        typeof status === "boolean"
          ? status
          : undefined,
      created_by: created_by ? Number(created_by) : undefined,
    };

    const data = await deliveryMethodService.fetchDeliveryMethods(dto);
    logger.info("Successfully retrieved delivery methods");
    sendSuccessResponse(res, data);
    return;
  } catch (error) {
    logger.error((error as Error).message || "Internal server error", error);
    sendErrorResponse(res, "Internal server error");
    return;
  }
};

export const getDeliveryMethodById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(Number(id))) {
      sendErrorResponse(res, "Invalid delivery method ID", 400);
      return;
    }

    const dto: GetDeliveryMethodByIdRequestDTO = { id: Number(id) };
    const deliveryMethod = await deliveryMethodService.getDeliveryMethodById(
      dto
    );

    if (!deliveryMethod) {
      sendErrorResponse(res, "Delivery method not found", 404);
      return;
    }

    logger.info("Successfully retrieved delivery method by ID: %s", id);
    sendSuccessResponse(res, deliveryMethod);
    return;
  } catch (error) {
    logger.error((error as Error).message || "Internal server error", error);
    sendErrorResponse(res, "Internal server error");
    return;
  }
};

export const updateDeliveryMethod = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { method_type, status, created_by } =
      req.body as UpdateDeliveryMethodRequestDTO;

    if (!id || isNaN(Number(id))) {
      sendErrorResponse(res, "Invalid delivery method ID", 400);
      return;
    }
    if (
      method_type !== undefined &&
      (typeof method_type !== "string" || method_type.trim() === "")
    ) {
      sendErrorResponse(res, "method_type must be a non-empty string", 400);
      return;
    }

    const dto: UpdateDeliveryMethodRequestDTO = {
      method_type,
      status,
      created_by,
    };
    const updatedDelivery = await deliveryMethodService.updateDeliveryMethod(
      Number(id),
      dto
    );

    logger.info("Successfully updated delivery method with ID: %s", id);
    sendSuccessResponse(res, updatedDelivery);
    return;
  } catch (error) {
    logger.error((error as Error).message || "Internal server error", error);
    sendErrorResponse(res, "Internal server error");
    return;
  }
};
