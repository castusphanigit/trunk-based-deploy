import type { Request, Response } from "express";
import { ServiceRequestService } from "../../services/serviceRequest.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
} from "../../utils/responseUtils";
import { CreateServiceRequestInput } from "../../types/dtos/serviceRequest.dto";
import logger from "../../utils/logger";

const serviceRequestService = new ServiceRequestService();

export const createServiceRequest = async (
  req: Request<Record<string, string>, unknown, CreateServiceRequestInput>,
  res: Response
): Promise<Response> => {
  try {
    const files = req.files as Express.Multer.File[];
    const newRequest = await serviceRequestService.createServiceRequest(
      req.body,
      files || []
    ); 
    logger.info("Successfully created service request");
    return sendSuccessResponse(res, newRequest, "201");
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const getTireSizes = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info("Incoming request to get tire sizes");
    const tireSizes = await serviceRequestService.getTireSizes();
    logger.info("Successfully retrieved %d tire sizes", tireSizes.length);
    return sendSuccessResponse(res, tireSizes, "200");
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const getTENFacilitiesList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info("Incoming request to get TEN facilities list");  
    const facilities = await serviceRequestService.getTENFacilitiesList();
    logger.info("Successfully retrieved %d TEN facilities", facilities.length);
    return sendSuccessResponse(res, facilities, "200");
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const getSavedLocationsList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info("Incoming request to get saved locations: user_id=%s", req.query.user_id);  
    const userId = req.query.user_id as string;
    if (!userId) {
      return sendErrorResponse(res, "user_id query parameter is required", 400);
    }
    const savedLocations = await serviceRequestService.getSavedLocationsList(
      Number(userId)
    );
    logger.info("Successfully retrieved %d saved locations", savedLocations.length);
    return sendSuccessResponse(res, savedLocations, "200");
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const getSavedLocationById = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info("Incoming request to get saved location: id=%s", req.params.id);
    const locationId = req.params.id;
    if (!locationId) {
      return sendErrorResponse(res, "Location ID parameter is required", 400);
    }
    const savedLocation = await serviceRequestService.getSavedLocationById(
      Number(locationId)
    );
    logger.info("Successfully retrieved saved location");
    return sendSuccessResponse(res, savedLocation, "200");
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};
export const updateSavedLocation = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info("Incoming request to update saved location: id=%s", req.params.id);
    const locationId = req.params.id;
    const updatedLocation = await serviceRequestService.updateSavedLocation(
      Number(locationId),
      req.body as {
        location_nick_name?: string,
        unit_street?: string,
        unit_city?: string,
        unit_state?: string,
        unit_zipcode?: string
      }
    );
    logger.info("Successfully updated saved location");
    return sendSuccessResponse(res, updatedLocation, "200");
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const deleteSavedLocation = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info("Incoming request to delete saved location: id=%s", req.params.id); 
    const locationId = req.params.id;
    const deletedLocation = await serviceRequestService.deleteSavedLocation(
      Number(locationId)
    );
    logger.info("Successfully deleted saved location");
    return sendSuccessResponse(res, deletedLocation, "200");
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const downloadServiceRequestDetailsPDF = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info("Incoming request to download service request PDF: id=%s", req.params.id);
    
    const serviceRequestId = req.params.id;

    if (!serviceRequestId) {
      return sendErrorResponse(
        res,
        "Service request ID parameter is required",
        400
      );
    }
    const pdfResult =
      await serviceRequestService.generateServiceRequestDetailsPDF(
        Number(serviceRequestId)
      );
    logger.info("Successfully generated PDF for service request");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${pdfResult.filename}"`
    );
    res.setHeader("Content-Length", pdfResult.buffer.length);

    return res.send(pdfResult.buffer);
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const downloadServiceRequestsHistory = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info("Incoming request to download service requests history");
    const requestBody = req.body as {
      columns: { label: string, field: string, maxWidth?: number }[],
      sort?: Record<string, string>,
      trailer?: string,
      submitted_on?: string,
      submitted_by?: string,
      issue?: string,
      repaired_by?: string,
      location?: string
    };
    const result = await serviceRequestService.downloadServiceRequestsHistory(
      requestBody
    );
    logger.info("Successfully generated service requests history file");
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.filename}"`
    );
    res.setHeader("Content-Length", result.buffer.length);
    return res.send(result.buffer);
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const getServiceCategories = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info("Incoming request to get service categories");
    const serviceCategories =
      await serviceRequestService.getServiceCategories();
    logger.info("Successfully retrieved %d service categories", serviceCategories.length);
    return sendSuccessResponse(res, serviceCategories, "200");
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const getServiceRequestById = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info("Incoming request to get service request: id=%s", req.params.id);
    const serviceRequestId = req.params.id;
    if (!serviceRequestId) {
      return sendErrorResponse(
        res,
        "Service request ID parameter is required",
        400
      );
    } 
    const serviceRequest = await serviceRequestService.getServiceRequestById(
      Number(serviceRequestId)
    );
    logger.info("Successfully retrieved service request");
    return sendSuccessResponse(res, serviceRequest, "200");
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const getServiceRequestsList = async (req: Request, res: Response) => {
  try {
    logger.info("Incoming request to get service requests list: query=%o", req.query);
    const {
      page,
      perPage,
      sort,
      accountIds,
      trailer,
      submitted_by,
      issue,
      repaired_by,
      location,
      submitted_on,
    } = req.query;

    if (!accountIds) {
      return sendErrorResponse(res, "accountIds parameter is required", 400);
    }
    const accountIdsArray = (accountIds as string)
      .split(",")
      .map((id) => Number(id.trim()));
    const filters: Record<string, string> = {};
    if (trailer) filters.trailer = trailer as string;
    if (submitted_by) filters.submitted_by = submitted_by as string;
    if (issue) filters.issue = issue as string;
    if (repaired_by) filters.repaired_by = repaired_by as string;
    if (location) filters.location = location as string;
    if (submitted_on) filters.submitted_on = submitted_on as string;
    const result = await serviceRequestService.getServiceRequestsList(
      Number(page) || 1,
      Number(perPage) || 10,
      sort as string,
      filters,
      accountIdsArray
    );
    logger.info("Successfully retrieved %d service requests", result.data?.length || 0);
    res.status(200).json({ success: true, ...result });
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const getAccountByEquipmentId = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info("Incoming request to get account by equipment: equipmentId=%s", req.params.equipmentId);
    const equipmentId = req.params.equipmentId;
    if (!equipmentId) {
      return sendErrorResponse(res, "Equipment ID parameter is required", 400);
    }
    const result = await serviceRequestService.getAccountByEquipmentId(
      Number(equipmentId)
    );
    logger.info("Successfully retrieved account for equipment");
    return sendSuccessResponse(res, result, "200");
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const getServiceUrgencyTypesList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info("Incoming request to get service urgency types");
    const urgencyTypes =
      await serviceRequestService.getServiceUrgencyTypesList();
    logger.info("Successfully retrieved %d service urgency types", urgencyTypes.length);
    return sendSuccessResponse(res, urgencyTypes, "200");
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const getServiceUrgencyList = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info("Incoming request to get service urgency list");
    const urgencyList = await serviceRequestService.getServiceUrgencyList();
    logger.info("Successfully retrieved %d service urgency items", urgencyList.length);
    return sendSuccessResponse(res, urgencyList, "200");
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};