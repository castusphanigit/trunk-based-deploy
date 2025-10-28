import { Request, Response } from "express";
import {
  downloadActivityFeedByUserService,
  getActivityFeedByUserService,
  createActivityFeedService,
  //   downloadActivityFeedByUserService,
} from "../../services/activityFeed.service";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../../utils/responseUtils";
import logger from "../../utils/logger";

// Controller: fetch paginated activity feed for a user
export const getActivityFeedByUser = async (req: Request, res: Response) => {
  try {
    const custId = Number(req.params.custId);
    const userIdFromParams =
      typeof req.params.userId === "string" && req.params.userId.length
        ? Number(req.params.userId)
        : undefined;
    const userIdFromQuery =
      typeof req.query.userId === "string" ||
      typeof req.query.userId === "number"
        ? Number(req.query.userId)
        : undefined;
    const userId = userIdFromParams ?? userIdFromQuery;

    if (!custId) {
      sendErrorResponse(res, "Missing or invalid custId", 400);
      return;
    }

    const page = Number(req.query.page) || 1;
    const perPage = Number(req.query.perPage) || 20;

    const { feeds, meta } = await getActivityFeedByUserService(
      custId,
      page,
      perPage,
      req.query,
      userId
    );

    logger.info(
      "Successfully retrieved activity feed for customer: %d",
      custId
    );
    sendSuccessResponse(
      res,
      { feeds, meta },
      "User activity feed fetched successfully"
    );
    return;
  } catch (error) {
    logger.error((error as Error).message || "Internal server error", error);
    sendErrorResponse(res, "Internal server error");
    return;
  }
};

// Controller: download activity feed for user as Excel file
export const downloadActivityFeedByUser = async (
  req: Request,
  res: Response
) => {
  try {
    const custId = Number(req.params.custId);
    const userIdFromParams =
      typeof req.params.userId === "string" && req.params.userId.length
        ? Number(req.params.userId)
        : undefined;
    const userIdFromQuery =
      typeof req.query.userId === "string" ||
      typeof req.query.userId === "number"
        ? Number(req.query.userId)
        : undefined;
    const userId = userIdFromParams ?? userIdFromQuery;
    if (!custId) {
      sendErrorResponse(res, "Missing or invalid custId", 400);
      return;
    }

    // Validate and cast req.body to DownloadActivityFeedBody
    // const body: DownloadActivityFeedBody = req.body as DownloadActivityFeedBody;

    const { buffer, filename } = await downloadActivityFeedByUserService(
      custId,
      req.query,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      req.body,
      userId
    );

    logger.info(
      "Successfully generated activity feed download for customer: %d",
      custId
    );
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.send(buffer);
  } catch (error) {
    logger.error((error as Error).message || "Internal server error", error);
    sendErrorResponse(res, "Internal server error");
    return;
  }
};

// Controller: create new activity feed entry
export const createActivityFeed = async (req: Request, res: Response) => {
  try {
    // Get data directly from req.body with proper typing
    const {
      customer_id,
      created_by,
      equipment_id,
      account_id,
      geofence_id,
      telematic_alert_id,
      alert_type_id,
      alert_category_id,
      latitude,
      longitude,
      event_time,
    } = req.body as {
      customer_id: number;
      created_by?: number;
      equipment_id?: number;
      account_id?: number;
      geofence_id?: number;
      telematic_alert_id?: number;
      alert_type_id?: number;
      alert_category_id?: number;
      latitude: number;
      longitude: number;
      event_time?: string | Date;
    };

    // Validate required fields
    if (!customer_id) {
      sendErrorResponse(res, "Customer ID is required", 400);
      return;
    }

    if (latitude === undefined || longitude === undefined) {
      sendErrorResponse(res, "Latitude and longitude are required", 400);
      return;
    }

    // Create data object with all fields from request body
    const createData = {
      equipment_id,
      account_id,
      customer_id,
      geofence_id,
      telematic_alert_id,
      alert_type_id,
      alert_category_id,
      latitude,
      longitude,
      event_time,
      created_by,
      updated_by: created_by,
    };

    const activityFeed = await createActivityFeedService(createData);

    logger.info("Successfully created activity feed entry");
    sendSuccessResponse(
      res,
      activityFeed,
      "Activity feed created successfully",
      201
    );
    return;
  } catch (error) {
    logger.error((error as Error).message || "Internal server error", error);
    sendErrorResponse(res, "Internal server error");
    return;
  }
};
