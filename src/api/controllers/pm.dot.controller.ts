import { Request, Response } from "express";
import { PmService } from "../../services/pm.dot.service";
import logger from "../../utils/logger";

import {
  sendSuccessResponse,
  sendErrorResponse,
  sendPaginatedResponse,
} from "../../utils/responseUtils";
import type {
  PMsByAccountsQuery,
  CombinedRecordsQuery,
  DOTInspectionFilterQuery,
  PMsByEquipmentQuery,
} from "../../types/dtos/pm.dto";
import { ColumnDefinition } from "../../types/common/request.types";

const pmService = new PmService();

export const getPMsByAccounts = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info(
      "Incoming request to get PMs by accounts: accountIds=%s",
      req.query.accountIds
    );
    const accountIdsRaw = req.query.accountIds as string | undefined;
    if (!accountIdsRaw) {
      return sendErrorResponse(res, "MISSING_ACCOUNT_IDS", 400);
    }
    const query: PMsByAccountsQuery = {
      accountIds: accountIdsRaw
        .split(",")
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isFinite(id)),
      page: req.query.page ? Number(req.query.page) : 1,
      perPage: req.query.perPage ? Number(req.query.perPage) : 10,
      type: req.query.type as string | undefined,
      pm_task_description: req.query.pm_task_description as string | undefined,
      frequency_interval: req.query.frequency_interval
        ? Number(req.query.frequency_interval)
        : undefined,
      frequency_type: req.query.frequency_type as string | undefined,
      status: req.query.status as string | undefined,
      equipment_id: req.query.equipment_id
        ? Number(req.query.equipment_id)
        : undefined,
      unit_number: req.query.unit_number as string | undefined,
      equipment_type: req.query.equipment_type as string | undefined,
      facility_code: req.query.facility_code as string | undefined,
      facility_name: req.query.facility_name as string | undefined,
      fetchAll: req.query.fetchAll === "true",
    };
    const { data, totalUnits, page, perPage, counts } =
      await pmService.getPMsByAccounts(query);
    logger.info("Successfully retrieved %d PM schedules", data.length);
    return sendPaginatedResponse(res, data, totalUnits, page, perPage, 200, {
      counts,
    });
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};
export const getPMScheduleDetail = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info(
      "Incoming request to get PM schedule detail: pmScheduleId=%s",
      req.params.pmScheduleId
    );
    const pmScheduleId = Number(req.params.pmScheduleId);
    if (!pmScheduleId || Number.isNaN(pmScheduleId)) {
      return sendErrorResponse(
        res,
        "Missing or invalid pmScheduleId parameter",
        400
      );
    }
    const detail = await pmService.getPMScheduleDetail(pmScheduleId);
    logger.info("Successfully retrieved PM schedule detail");
    return sendSuccessResponse(res, detail);
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const getDOTInspectionsByAccounts = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info(
      "Incoming request to get DOT inspections by accounts: accountIds=%s",
      req.query.accountIds
    );
    const { data, meta } = await pmService.getDOTInspectionsByAccounts(
      req.query as unknown as DOTInspectionFilterQuery
    );
    const { totalInspections, page, perPage, counts } = meta;
    logger.info("Successfully retrieved %d DOT inspections", data.length);
    return sendPaginatedResponse(
      res,
      data,
      totalInspections,
      page,
      perPage,
      200,
      {
        counts,
      }
    );
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

// Helper function to safely decode URL-encoded values
const decodeSafe = (value?: string): string | undefined => {
  if (!value) return undefined;

  // handle double encoding like %%20
  const cleaned = value.replaceAll("%%", "%");

  try {
    let decoded = decodeURIComponent(cleaned);

    // 🔧 If the value looks like a number followed by a space and parentheses (e.g., 50 (1945)),
    // and it's missing a %, restore it
    if (/^\d+\s*\(\d+\)$/.test(decoded)) {
      decoded = decoded.replace(/^(\d+)\s*\(/, "$1% (");
    }

    return decoded;
  } catch {
    return cleaned;
  }
};

// Helper function to build the combined records query object
const buildCombinedRecordsQuery = (queryRaw: Record<string, unknown>): CombinedRecordsQuery => {
  return {
    accountIds: queryRaw.accountIds as string,
    pm_type: queryRaw.pm_type as string | undefined,
    pm_task_description: queryRaw.pm_task_description as string | undefined,
    frequency_interval: queryRaw.frequency_interval
      ? Number(queryRaw.frequency_interval)
      : undefined,
    frequency_type: queryRaw.frequency_type as string | undefined,
    status: queryRaw.status as string | undefined,
    facility_code: queryRaw.facility_code as string | undefined,
    facility_name: queryRaw.facility_name as string | undefined,
    equipment_id: queryRaw.equipment_id
      ? Number(queryRaw.equipment_id)
      : undefined,
    unit_number: queryRaw.unit_number as string | undefined,
    equipment_type: queryRaw.equipment_type as string | undefined,
    inspection_result: queryRaw.inspection_result as string | undefined,
    inspector_name: queryRaw.inspector_name as string | undefined,
    notes: queryRaw.notes as string | undefined,
    inspection_status: queryRaw.inspection_status as string | undefined,
    type: queryRaw.type as string | undefined,
    compliance: decodeSafe(queryRaw.compliance as string | undefined),
    violation_code: queryRaw.violation_code as string | undefined,
    severity_level: queryRaw.severity_level as string | undefined,
    valid_through: queryRaw.valid_through as string | undefined,
    sort: queryRaw.sort as string | undefined,
    page: queryRaw.page ? Number(queryRaw.page) : undefined,
    perPage: queryRaw.perPage ? Number(queryRaw.perPage) : undefined,
    skip: queryRaw.skip ? Number(queryRaw.skip) : undefined,
    take: queryRaw.take ? Number(queryRaw.take) : undefined,
    next_inspection_due: queryRaw.next_inspection_due as string | undefined,
    inspection_date: queryRaw.inspection_date as string | undefined,
    lastEvent_performed_date: queryRaw.lastEvent_performed_date as
      | string
      | undefined,
    nextEvent_next_due_date: queryRaw.nextEvent_next_due_date as
      | string
      | undefined,
  };
};

export const getCombinedRecords = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info(
      "Incoming request to get combined records: accountIds=%s",
      req.query.accountIds
    );

    const query = buildCombinedRecordsQuery(req.query);

    if (!query.accountIds) {
      return sendErrorResponse(res, "accountIds is required", 400);
    }

    const result = await pmService.getCombinedRecords(query);

    logger.info("Successfully retrieved combined records");
    return sendSuccessResponse(res, result);
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const getDOTInspectionById = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info(
      "Incoming request to get DOT inspection by ID: dotInspectionId=%s",
      req.params.dotInspectionId
    );
    const { dotInspectionId } = req.params;
    if (!dotInspectionId) {
      return sendErrorResponse(res, "Missing dotInspectionId parameter", 400);
    }
    const inspection = await pmService.getDOTInspectionById(
      Number(dotInspectionId)
    );
    if (!inspection) {
      return sendErrorResponse(res, "DOT Inspection not found", 404);
    }
    logger.info("Successfully retrieved DOT inspection");
    return res.status(200).json({
      status: "success",
      data: inspection,
    });
  } catch (error: unknown) {
    logger.error("Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};

export const downloadCombinedRecords = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    logger.info("Incoming request to download combined records");
    const { query, columns } = req.body as {
      query: CombinedRecordsQuery,
      columns: ColumnDefinition[]
    };

    if (!columns || !Array.isArray(columns)) {
      res.status(400).json({ error: "Columns are required" });
      return;
    }

    if (!query.accountIds) {
      res.status(400).json({ error: "Account IDs are required" });
      return;
    }

    const { buffer, filename } = await pmService.downloadCombinedRecords(
      query,
      columns
    );
    logger.info("Successfully generated combined records file");

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);

    res.send(buffer);
    return;
  } catch (error: unknown) {
    logger.error((error as Error).message || "Internal server error", error);
    sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
    return;
  }
};

export const getPMsByEquipment = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    logger.info(
      "Incoming request to get PMs by equipment: equipmentId=%s",
      req.params.equipmentId
    );

    const equipmentIdRaw = req.params.equipmentId;
    if (!equipmentIdRaw) {
      return sendErrorResponse(res, "MISSING_EQUIPMENT_ID", 400);
    }

    const query: PMsByEquipmentQuery = {
      equipmentId: equipmentIdRaw,
      page: req.query.page ? Number(req.query.page) : 1,
      perPage: req.query.perPage ? Number(req.query.perPage) : 10,
      type: req.query.type as string | undefined,
      pm_task_description: req.query.pm_task_description as string | undefined,
      frequency_interval: req.query.frequency_interval
        ? Number(req.query.frequency_interval)
        : undefined,
      frequency_type: req.query.frequency_type as string | undefined,
      status: req.query.status as string | undefined,
      unit_number: req.query.unit_number as string | undefined,
      equipment_type: req.query.equipment_type as string | undefined,
      facility_code: req.query.facility_code as string | undefined,
      facility_name: req.query.facility_name as string | undefined,
      fetchAll: req.query.fetchAll === "true",
    };

    const { data, totalUnits, page, perPage, counts } =
      await pmService.getPMsByEquipment(query);

    logger.info(
      "Successfully retrieved %d PM schedules for equipment",
      data.length
    );
    return sendPaginatedResponse(res, data, totalUnits, page, perPage, 200, {
      counts,
    });
  } catch (error) {
    logger.error((error as Error).message || "Internal server error", error);
    return sendErrorResponse(
      res,
      (error as Error).message || "Internal server error",
      500
    );
  }
};
