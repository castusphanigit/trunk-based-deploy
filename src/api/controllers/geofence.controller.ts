import { Request, Response } from "express";
import prisma from "../../config/database.config";

import {
  sendSuccessResponse,
  sendErrorResponse,
  sendPaginatedResponse,
} from "../../utils/responseUtils";

import { GeofenceService } from "../../services/geofence.service";

import { GetGeofenceByUserIdQuery } from "../../types/dtos/geofence-request.dto";
import logger from "../../utils/logger";

// Type aliases to replace union types
type GeofenceId = number | string;
type GeofenceStatus = "ACTIVE" | "IN-ACTIVE";
type GeofenceShape = "Polygon" | "Circle";
type CoordinateValue = string | number | null;
type AccountIds = number[] | string;
type NullableString = string | null;

// Local request body shapes used by controllers to avoid `any`
interface CreateGeofenceBody {
  geofence_name: string;
  shape_type: GeofenceShape;
  polygon?: NullableString;
  center_lat?: CoordinateValue;
  center_lng?: CoordinateValue;
  radius_meters?: CoordinateValue;
  owner?: NullableString;
  tag_lookup_id?: number | null;
  customer_id: GeofenceId;
  account_ids: AccountIds;
  description?: NullableString;
  geofence_location?: NullableString;
  status?: GeofenceStatus | null;
  created_by?: number | null;
  assets_in_geofence?: number | null;
  zoom_level?: number | null;
}

interface UpdateGeofenceBody extends Partial<CreateGeofenceBody> {
  updated_by?: number | null;
}

// Helper functions to reduce cognitive complexity
const validateGeofenceId = (id: string): boolean => {
  return !!(id && !isNaN(Number(id)));
};

const validateShapeType = (
  shapeType: string,
  polygon?: NullableString,
  centerLat?: CoordinateValue,
  centerLng?: CoordinateValue,
  radiusMeters?: CoordinateValue
): string | null => {
  if (shapeType === "Polygon" && !polygon) {
    return "Polygon shape requires 'polygon' field with coordinates";
  }
  if (
    shapeType === "Circle" &&
    (centerLat == null || centerLng == null || radiusMeters == null)
  ) {
    return "Circle shape requires center_lat, center_lng and radius_meters";
  }
  return null;
};

const validateRequiredFields = (body: CreateGeofenceBody): string | null => {
  if (
    !body.geofence_name ||
    !body.shape_type ||
    !body.customer_id ||
    !Array.isArray(body.account_ids) ||
    body.account_ids.length === 0
  ) {
    return "Missing required fields: geofence_name, shape_type, customer_id, account_ids";
  }
  return null;
};

const buildGeofenceParams = (body: CreateGeofenceBody): unknown[] => {
  const createdBy = body.created_by;
  const updatedBy = createdBy;

  return [
    JSON.stringify(body.account_ids),
    body.customer_id,
    body.geofence_name,
    body.shape_type,
    body.polygon ?? null,
    body.center_lat ? parseFloat(String(body.center_lat)) : null,
    body.center_lng ? parseFloat(String(body.center_lng)) : null,
    body.radius_meters ? parseFloat(String(body.radius_meters)) : null,
    body.owner,
    body.tag_lookup_id ?? null,
    body.description ?? null,
    body.geofence_location ?? null,
    body.status ?? "ACTIVE",
    createdBy,
    updatedBy,
    body.assets_in_geofence ?? null,
    body.zoom_level ?? null,
  ];
};

const buildFilterConditions = (
  query: GetGeofenceByUserIdQuery,
  values: unknown[],
  paramIndex: number
): { filters: string[]; newParamIndex: number } => {
  const filters: string[] = [];
  let currentParamIndex = paramIndex;

  if (query.geofence_name) {
    filters.push(`g.geofence_name ILIKE $${currentParamIndex++}`);
    values.push(`%${query.geofence_name}%`);
  }
  if (query.geofence_location) {
    filters.push(`g.geofence_location ILIKE $${currentParamIndex++}`);
    values.push(`%${query.geofence_location}%`);
  }
  if (query.shape_type) {
    filters.push(`g.shape_type = $${currentParamIndex++}`);
    values.push(query.shape_type);
  }
  if (query.status) {
    filters.push(`g.status = $${currentParamIndex++}`);
    values.push(query.status);
  }
  if (query.globalSearch) {
    const searchPattern = `%${query.globalSearch}%`;
    filters.push(`(
    g.geofence_name ILIKE $${currentParamIndex} OR
    g.geofence_location ILIKE $${currentParamIndex + 1} OR
    g.shape_type ILIKE $${currentParamIndex + 2} OR
    g.status ILIKE $${currentParamIndex + 3}
  )`);
    values.push(searchPattern, searchPattern, searchPattern, searchPattern);
    currentParamIndex += 4;
  }

  return { filters, newParamIndex: currentParamIndex };
};

const parsePolygonData = (
  polygon: unknown
): { lat: number; lng: number }[] | null => {
  if (!polygon || typeof polygon !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(polygon) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "coordinates" in (parsed as Record<string, unknown>)
    ) {
      const coords = (parsed as Record<string, unknown>).coordinates;
      if (Array.isArray(coords) && Array.isArray(coords[0])) {
        return (coords[0] as unknown[])
          .map((pair: unknown) => {
            if (
              Array.isArray(pair) &&
              typeof pair[0] === "number" &&
              typeof pair[1] === "number"
            ) {
              return {
                lat: (pair as number[])[1],
                lng: (pair as number[])[0],
              };
            }
            return null;
          })
          .filter(Boolean) as { lat: number; lng: number }[];
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Polygon parse error:", e);
  }

  return null;
};

// Interface for field mapping to prevent SQL injection
interface FieldMapping {
  field: string;
  transform?: (value: unknown) => unknown;
}

const buildUpdateFields = (
  body: UpdateGeofenceBody
): { fields: string[]; values: unknown[]; idx: number } => {
  const updateFields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  // Define allowed field mappings to prevent SQL injection
  const fieldMappings: Record<string, FieldMapping> = {
    account_ids: {
      field: "account_ids",
      transform: (value) => JSON.stringify(value),
    },
    customer_id: { field: "customer_id" },
    geofence_name: { field: "geofence_name" },
    shape_type: { field: "shape_type" },
    polygon: { field: "polygon" },
    center_lat: { field: "center_lat", transform: (value) => Number(value) },
    center_lng: { field: "center_lng", transform: (value) => Number(value) },
    radius_meters: {
      field: "radius_meters",
      transform: (value) => Number(value),
    },
    owner: { field: "owner" },
    tag_lookup_id: { field: "tag_lookup_id" },
    description: { field: "description" },
    geofence_location: { field: "geofence_location" },
    status: { field: "status" },
    updated_by: { field: "updated_by" },
    assets_in_geofence: { field: "assets_in_geofence" },
    zoom_level: { field: "zoom_level" },
  };

  const addField = (condition: boolean, fieldKey: string, value: unknown) => {
    if (condition && fieldMappings[fieldKey]) {
      const mapping = fieldMappings[fieldKey];
      const transformedValue = mapping.transform
        ? mapping.transform(value)
        : value;

      // Special handling for polygon field
      if (fieldKey === "polygon" && body.shape_type === "Polygon") {
        updateFields.push(`${mapping.field} = ST_GeomFromText($${idx}, 4326)`);
      } else if (fieldKey === "account_ids") {
        updateFields.push(`${mapping.field} = $${idx}::jsonb`);
      } else {
        updateFields.push(`${mapping.field} = $${idx}`);
      }

      values.push(transformedValue);
      idx++;
    }
  };

  addField(body.account_ids !== undefined, "account_ids", body.account_ids);
  addField(body.customer_id !== undefined, "customer_id", body.customer_id);
  addField(
    body.geofence_name !== undefined,
    "geofence_name",
    body.geofence_name
  );
  addField(body.shape_type !== undefined, "shape_type", body.shape_type);
  addField(
    !!(body.shape_type === "Polygon" && body.polygon),
    "polygon",
    body.polygon
  );
  addField(
    body.center_lat !== undefined && body.center_lat !== null,
    "center_lat",
    body.center_lat
  );
  addField(
    body.center_lng !== undefined && body.center_lng !== null,
    "center_lng",
    body.center_lng
  );
  addField(
    body.radius_meters !== undefined && body.radius_meters !== null,
    "radius_meters",
    body.radius_meters
  );
  addField(body.owner !== undefined, "owner", body.owner);
  addField(
    body.tag_lookup_id !== undefined,
    "tag_lookup_id",
    body.tag_lookup_id
  );
  addField(body.description !== undefined, "description", body.description);
  addField(
    body.geofence_location !== undefined,
    "geofence_location",
    body.geofence_location
  );
  addField(body.status !== undefined, "status", body.status);
  addField(body.updated_by !== undefined, "updated_by", body.updated_by);
  addField(
    body.assets_in_geofence !== undefined,
    "assets_in_geofence",
    body.assets_in_geofence
  );
  addField(body.zoom_level !== undefined, "zoom_level", body.zoom_level);

  return { fields: updateFields, values, idx };
};

// Removed unused interfaces to satisfy linter

/**
 * Creates a new geofence
 * Validates required fields and creates geofence with polygon or circle geometry
 *
 * @param req - Express request object containing geofence data
 * @param res - Express response object
 * @returns Created geofence ID or error response
 * @author chaitanya
 */
export const createGeofenceCtrl = async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateGeofenceBody;

    // Validate required fields
    const requiredFieldsError = validateRequiredFields(body);
    if (requiredFieldsError) {
      return sendErrorResponse(res, requiredFieldsError);
    }

    // Validate shape type requirements
    const shapeValidationError = validateShapeType(
      body.shape_type,
      body.polygon,
      body.center_lat,
      body.center_lng,
      body.radius_meters
    );
    if (shapeValidationError) {
      return sendErrorResponse(res, shapeValidationError);
    }

    const sql = `
      INSERT INTO geofence (
        account_ids,
        customer_id,
        geofence_name,
        shape_type,
        polygon,
        center_lat,
        center_lng,
        radius_meters,
        owner,
        tag_lookup_id,
        description,
        geofence_location,
        status,
        created_by,
        is_deleted,
        created_at,
        updated_at,
        updated_by,
        assets_in_geofence,
        zoom_level
      ) VALUES (
        $1::jsonb, $2, $3, $4,
        CASE 
          WHEN $4 = 'Polygon' THEN ST_GeomFromText($5, 4326)
          ELSE NULL
        END,
        $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        false, NOW(), NOW(), $15, $16::int ,$17
      )
      RETURNING geofence_id
    `;

    const params = buildGeofenceParams(body);
    const insertedRows = await prisma.$queryRawUnsafe<
      { geofence_id: number }[]
    >(sql, ...params);
    const geofenceAccountId = insertedRows[0].geofence_id;

    logger.info("Successfully created geofence with ID: %d", geofenceAccountId);
    return sendSuccessResponse(
      res,
      geofenceAccountId,
      "Geofence created successfully"
    );
  } catch (error) {
    logger.error(
      (error as Error).message || "Failed to create geofence",
      error
    );
    return sendErrorResponse(res, "Failed to create geofence");
  }
};

/**
 * Updates an existing geofence
 * Validates geofence ID and updates geofence data with optional field validation
 *
 * @param req - Express request object with geofence ID and update data
 * @param res - Express response object
 * @returns Success message or error response
 * @author chaitanya
 */
export const updateGeofenceCtrl = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body as UpdateGeofenceBody;

    if (!validateGeofenceId(id)) {
      return sendErrorResponse(res, "Valid geofence ID is required");
    }

    // Validate shape type requirements
    const shapeValidationError = validateShapeType(
      body.shape_type ?? "",
      body.polygon,
      body.center_lat,
      body.center_lng,
      body.radius_meters
    );
    if (shapeValidationError) {
      return sendErrorResponse(res, shapeValidationError);
    }

    // Build update fields using helper function
    const { fields: updateFields, values, idx } = buildUpdateFields(body);

    // Always update updated_at
    updateFields.push(`updated_at = NOW()`);

    // Final query with proper parameterization
    const query = `
      UPDATE geofence
      SET ${updateFields.join(", ")}
      WHERE geofence_id = $${idx}
    `;
    values.push(Number(id));

    const result = await prisma.$executeRawUnsafe(query, ...values);

    if (result === 0) {
      return sendErrorResponse(res, "Geofence not found", 404);
    }

    logger.info("Successfully updated geofence with ID: %s", id);
    return sendSuccessResponse(res, null, "Geofence updated successfully");
  } catch (error) {
    logger.error(
      (error as Error).message || "Failed to update geofence",
      error
    );
    return sendErrorResponse(res, "Failed to update geofence");
  }
};

/**
 * Retrieves a geofence by ID
 * Fetches detailed geofence information including polygon data and related accounts
 *
 * @param req - Express request object with geofence ID parameter
 * @param res - Express response object
 * @returns Detailed geofence data or error response
 * @author chaitanya
 */
export const getGeofenceByIdCtrl = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return sendErrorResponse(res, "Valid geofence ID is required");
    }

    const geofence = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `
      SELECT 
        g.geofence_id,
        g.geofence_name,
        g.shape_type,
        ST_AsGeoJSON(g.polygon) AS polygon,
        g.center_lat,
        g.center_lng,
        g.radius_meters,
        g.owner,
        g.description,
        g.geofence_location,
        g.status,
        g.created_by,
        g.created_at,
        g.updated_at,
        g.updated_by,
        g.zoom_level,
        t.tag_lookup_id,
        t.tag_name,
       
        json_build_object(
          'first_name', cu.first_name,
          'last_name', cu.last_name,
          'email', cu.email
        ) AS created_by_user,
           json_build_object(
          'first_name', uu.first_name,
          'last_name', uu.last_name,
          'email', uu.email
        ) AS updated_by_user,
        (
          SELECT COALESCE(
            (
              SELECT json_agg(json_build_object(
                'account_id', a.account_id,
                'account_name', a.account_name,
                'account_number', a.account_number
              ))
              FROM account a
              WHERE a.account_id = ANY(
                SELECT json_array_elements_text(
                  CASE 
                    WHEN g.account_ids IS NULL THEN '[]'::json
                    ELSE g.account_ids::json
                  END
                )::integer
              )
            ),
            '[]'::json
          )
        ) AS accounts
      FROM geofence g
      LEFT JOIN tag_lookup t 
        ON g.tag_lookup_id = t.tag_lookup_id
    
      LEFT JOIN "user" cu 
        ON g.created_by = cu.user_id
          LEFT JOIN "user" uu 
        ON g.updated_by = uu.user_id
      WHERE g.geofence_id = $1 
        AND g.is_deleted = false
      `,
      Number(id)
    );

    if (!geofence || geofence.length === 0) {
      return sendErrorResponse(res, "Geofence not found", 404);
    }

    const g = geofence[0];

    //  Fetch alerts count for this geofence using Prisma ORM
    const alerts_for_geofence = await prisma.telematic_alert.count({
      where: {
        geofence_id: {
          has: Number(id), // checks if the array contains this geofence ID
        },
      },
    });

    // console.log(alerts_for_geofence);
    // Parse polygon if available
    let polygon = null;
    try {
      if (g.polygon && typeof g.polygon === "string") {
        type GeoJSONPolygon =
          | { coordinates: number[][][] }
          | { coordinates: number[][][]; type?: string };
        const geoJson = JSON.parse(g.polygon) as GeoJSONPolygon;
        polygon = geoJson.coordinates[0].map((pair: number[]) => ({
          lat: pair[1],
          lng: pair[0],
        }));
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Polygon parse error:", e);
    }

    const response = {
      id: g.geofence_id,
      geofence_name: g.geofence_name,
      geofence_shape: g.shape_type,
      center_lat: g.center_lat,
      center_lng: g.center_lng,
      radius_meters: g.radius_meters,
      polygon,
      owner: g.owner,
      description: g.description,
      geofence_location: g.geofence_location,
      status: g.status,
      tag_lookup_id: g.tag_lookup_id ?? null,
      tag_name: g.tag_name ?? null,
      alerts_for_geofence,

      created_by: g.created_by,
      created_by_user: g.created_by_user,
      updated_by: g.updated_by,
      updated_by_user: g.updated_by_user,
      created_at: g.created_at,
      updated_at: g.updated_at,
      zoom_level: g.zoom_level,
      accounts: g.accounts ?? [],
    };

    logger.info("Successfully retrieved geofence details for ID: %s", id);
    return sendSuccessResponse(
      res,
      response,
      "Geofence detail fetched successfully"
    );
  } catch (error) {
    logger.error((error as Error).message || "Failed to fetch geofence", error);
    return sendErrorResponse(res, "Failed to fetch geofence");
  }
};

/**
 * Retrieves all geofence polygons for a customer
 * Fetches paginated geofence data with filtering and search capabilities
 *
 * @param req - Express request object with customer ID and optional user ID
 * @param res - Express response object
 * @returns Paginated geofence polygons data or error response
 * @author chaitanya
 */
export const getAllGeofencePolygons = async (req: Request, res: Response) => {
  try {
    const { custId, userId } = req.params as unknown as {
      custId: string;
      userId?: string;
    };
    const q = req.query as unknown as GetGeofenceByUserIdQuery;
    const page = q.page ? Number(q.page) : 1;
    const perPage = q.perPage ? Number(q.perPage) : 10;

    if (!custId || isNaN(Number(custId))) {
      return sendErrorResponse(res, "Valid customer ID is required");
    }

    // Build filter conditions
    const values: unknown[] = [Number(custId)];
    const { filters, newParamIndex } = buildFilterConditions(q, values, 2);
    let paramIndex = newParamIndex;

    // Build WHERE clause with proper parameterization
    const whereConditions: string[] = [
      "g.customer_id = $1",
      "g.is_deleted = false",
    ];
    if (userId && !isNaN(Number(userId))) {
      whereConditions.push(`g.created_by = $${paramIndex++}`);
      values.push(Number(userId));
    }
    if (filters.length > 0) {
      whereConditions.push(...filters);
    }
    const whereClause = whereConditions.join(" AND ");

    // Get total count
    const countResult = await prisma.$queryRawUnsafe<{ count: string }[]>(
      `SELECT COUNT(*) AS count FROM geofence g WHERE ${whereClause}`,
      ...values
    );
    const total = Number(countResult[0]?.count ?? 0);

    // Get paginated results
    const offset = (page - 1) * perPage;
    const geofences = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `
      SELECT 
        g.geofence_id,
        g.geofence_name,
        g.shape_type,
        ST_AsGeoJSON(g.polygon) AS polygon,
        g.center_lat,
        g.center_lng,
        g.radius_meters,
        g.zoom_level,
        g.geofence_location
      FROM geofence g
      WHERE ${whereClause}
      ORDER BY g.geofence_id DESC
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex++}
      `,
      ...values,
      perPage,
      offset
    );

    if (!geofences || geofences.length === 0) {
      return sendErrorResponse(
        res,
        "No geofences found for this customer.",
        404
      );
    }

    // Parse and format results
    const results = geofences.map((g) => ({
      id: g.geofence_id,
      geofence_name: g.geofence_name,
      geofence_location: g.geofence_location,
      geofence_shape: g.shape_type,
      center_lat: g.center_lat,
      center_lng: g.center_lng,
      radius_meters: g.radius_meters,
      zoom_level: g.zoom_level,
      polygon: parsePolygonData(g.polygon),
    }));

    const meta = {
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    };

    logger.info(
      "Successfully retrieved %d geofences for customer: %s",
      results.length,
      custId
    );
    return sendSuccessResponse(
      res,
      { geofences: results, meta },
      "Geofences fetched successfully by customer"
    );
  } catch (error) {
    logger.error(
      (error as Error).message || "Failed to fetch geofences",
      error
    );
    return sendErrorResponse(res, "Failed to fetch geofences");
  }
};

const geofenceService = new GeofenceService();

/**
 * Retrieves geofences by user ID
 * Fetches paginated geofence data for a specific customer and user
 *
 * @param req - Express request object with customer ID and optional user ID
 * @param res - Express response object
 * @returns Paginated geofence data or error response
 * @author chaitanya
 */
export const getGeofenceByUserIdCtrl = async (req: Request, res: Response) => {
  try {
    const { custId, userId } = req.params as unknown as {
      custId: string;
      userId?: string;
    };
    const query = req.query as GetGeofenceByUserIdQuery;

    if (!custId || isNaN(Number(custId))) {
      return sendErrorResponse(res, "Valid customer ID is required");
    }

    const result = await geofenceService.getGeofencesByCustomer(
      { custId, userId },
      query
    );

    return sendPaginatedResponse(
      res,
      result.data,
      result.total,
      result.page,
      result.perPage,
      200
    );
  } catch (error) {
    logger.error(
      (error as Error).message || "Failed to fetch geofences by user id",
      error
    );
    return sendErrorResponse(
      res,
      error instanceof Error
        ? error.message
        : "Failed to fetch geofences by user id"
    );
  }
};

/**
 * Toggles geofence status
 * Switches geofence status between active and inactive states
 *
 * @param req - Express request object with geofence ID parameter
 * @param res - Express response object
 * @returns Updated status data or error response
 * @author chaitanya
 */
export const toggleGeofenceStatus = async (req: Request, res: Response) => {
  try {
    const { geofence_id } = req.params;

    if (!geofence_id || isNaN(Number(geofence_id))) {
      return sendErrorResponse(res, "Valid geofence_id is required", 400);
    }

    const newStatus = await geofenceService.toggleGeofenceStatus(
      Number(geofence_id)
    );
    logger.info(
      "Successfully toggled geofence status to: %s for ID: %s",
      newStatus,
      geofence_id
    );
    return sendSuccessResponse(res, newStatus, "Status updated successfully");
  } catch (error) {
    if (error instanceof Error && error.message === "Geofence not found") {
      return sendErrorResponse(res, error.message, 404);
    }
    logger.error((error as Error).message || "Error toggling status", error);
    return sendErrorResponse(res, "Error toggling status", 500);
  }
};

/**
 * Retrieves geofence counts by customer
 * Fetches statistical counts of geofences for a specific customer and user
 *
 * @param req - Express request object with customer ID and optional user ID
 * @param res - Express response object
 * @returns Geofence counts data or error response
 * @author chaitanya
 */
export const getGeofenceCountsCtrl = async (req: Request, res: Response) => {
  try {
    const { custId, userId } = req.params as unknown as {
      custId: string;
      userId?: string;
    };

    if (!custId || isNaN(Number(custId))) {
      return sendErrorResponse(res, "Valid customer ID is required");
    }

    const custIdNum = Number(custId);
    const userIdNum =
      userId && !isNaN(Number(userId)) ? Number(userId) : undefined;

    const counts = await geofenceService.getGeofenceCountsByCustomer(
      custIdNum,
      userIdNum
    );

    logger.info(
      "Successfully retrieved geofence counts for customer: %s",
      custId
    );
    return sendSuccessResponse(
      res,
      counts,
      "Geofence counts retrieved successfully"
    );
  } catch (error) {
    logger.error(
      (error as Error).message || "Failed to get geofence counts",
      error
    );
    return sendErrorResponse(res, "Failed to get geofence counts");
  }
};

/**
 * Downloads geofences as Excel file
 * Generates and downloads geofence data in Excel format for a specific user
 *
 * @param req - Express request object with customer ID and optional user ID
 * @param res - Express response object for file download
 * @returns Excel file download or error response
 * @author chaitanya
 */
export const downloadGeofenceByUserIdCtrl = async (
  req: Request,
  res: Response
) => {
  try {
    const params = req.params as unknown as { custId: string; userId?: string };
    const query = req.query as unknown as GetGeofenceByUserIdQuery;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const body = req.body;

    const { buffer, filename } = await geofenceService.downloadGeofenceByUserId(
      params,
      query,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      body
    );

    logger.info("Successfully generated geofence download file: %s", filename);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(filename)}"`
    );

    res.status(200).send(buffer);
  } catch (error) {
    logger.error(
      (error as Error).message || "Failed to download geofences by user id",
      error
    );
    return sendErrorResponse(
      res,
      error instanceof Error
        ? error.message
        : "Failed to download geofences by user id"
    );
  }
};
