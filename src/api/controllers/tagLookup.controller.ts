import { Request, Response } from "express";
import { TagLookupService } from "../../services/tag-lookup.service";
import { FetchTagLookupsQueryDto } from "../../types/dtos/tag-lookup-request.dto";
import {
  sendErrorResponse,
  sendPaginatedResponse,
} from "../../utils/responseUtils";
import logger from "../../utils/logger";

/**
 * Retrieves paginated tag lookup entries
 * Fetches tag lookups with pagination support and filtering capabilities
 *
 * @param req - Express request object with query parameters for pagination and filtering
 * @param res - Express response object
 * @returns Paginated tag lookup data or error response
 * @author chaitanya
 */
export const fetchTagLookups = async (req: Request, res: Response) => {
  try {
    const query = req.query as unknown as FetchTagLookupsQueryDto;
    const { data, total, page, perPage } =
      await TagLookupService.fetchTagLookups(query);
    logger.info("Successfully retrieved %d tag lookups", data.length);
    return sendPaginatedResponse(res, data, total, page, perPage);
  } catch (err) {
    logger.error((err as Error).message || "Internal server error", err);
    return sendErrorResponse(res, "Internal server error");
  }
};
