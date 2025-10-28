// controllers/globalSearchController.ts
import { Request, Response } from "express";
import { ParsedQs } from "qs";
import { globalSearchService } from "../../services/search.service";
import {
  sendSuccessResponse,
  sendErrorResponse,
} from "../../utils/responseUtils";

export const globalSearch = async (req: Request, res: Response) => {
  try {
    const { q: query, accountIds, page, perPage } = req.query;

    if (!query || typeof query !== "string" || query.length < 4) {
      return sendErrorResponse(
        res,
        "Search query must be at least 4 characters long",
        400
      );
    }

    // Parse accountIds from query string (can be comma-separated string or array)
    const parsedAccountIds = parseAccountIds(accountIds);

    // Parse pagination parameters
    const paginationParams = {
      page: page ? Number(page) : undefined,
      perPage: perPage ? Number(perPage) : undefined,
    };

    const results = await globalSearchService.performGlobalSearch(
      query,
      parsedAccountIds,
      paginationParams
    );

    return sendSuccessResponse(res, results, "Search completed successfully");
  } catch {
    // Log error for debugging purposes
    // Note: In production, this should use a proper logging service
    // Error is intentionally not used to avoid exposing internal details
    return sendErrorResponse(res, "Internal server error", 500);
  }
};

// Helper function to parse account IDs
const parseAccountIds = (
  accountIds: string | ParsedQs | (string | ParsedQs)[] | undefined
): number[] => {
  if (!accountIds) return [];

  if (Array.isArray(accountIds)) {
    return accountIds
      .filter((id) => typeof id === "string")
      .map((id) => Number(id))
      .filter((id) => !isNaN(id));
  }

  if (typeof accountIds === "string") {
    return accountIds
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => !isNaN(id));
  }

  return [];
};
