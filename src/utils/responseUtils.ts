import { Response } from "express";

export interface PaginatedResponse<T> {
  statusCode?: number;
  data: T;
  meta?: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}
export interface SuccessResponse<T> {
  data: T;
  statusCode?: number;
  tablename?: string;
  message?: string;
}

export interface ErrorResponse {
  error: string | object;
  statusCode?: number;
}

/**
 * Standard success response for paginated results
 */
export function sendPaginatedResponse<T>(
  res: Response, // Express Response type
  data: T,
  total: number,
  page: number,
  perPage: number,
  statusCode = 200,
  additionalData: Record<string, unknown> = {} // To allow counts,
) {
  const totalPages = Math.ceil(total / perPage);
  const responseBody: PaginatedResponse<T> = {
    statusCode,
    data,
    meta: {
      total,
      page,
      perPage,
      totalPages,
      ...additionalData, // Include any additional data like counts
    },
  };
  return res.status(statusCode).json(responseBody);
}

/**
 * Standard success response for non-paginated results
 */
export function sendSuccessResponse<T>(
  res: Response, // Express Response type
  data: T,

  message = "Success",
  statusCode = 200
) {
  const responseBody: SuccessResponse<T> = {
    statusCode,
    data,

    message,
  };
  return res.status(statusCode).json(responseBody);
}
/**
 * Standard error response
 */
export function sendErrorResponse(
  res: Response,
  errorMsg: string | object,
  statusCode = 500
) {
  const responseBody: ErrorResponse = {
    error: errorMsg,
    statusCode,
  };
  return res.status(statusCode).json(responseBody);
}

interface PaginatedBigIntOptions {
  statusCode?: number;
  message?: string;
  additionalData?: Record<string, unknown>;
}

export function sendPaginatedBigIntResponse<T>(
  res: Response,
  data: T,
  total: number,
  page: number,
  perPage: number,
  options: PaginatedBigIntOptions = {}
) {
  const {
    statusCode = 200,
    message = "Fetched successfully",
    additionalData = {},
  } = options;

  const totalPages = Math.ceil(total / perPage);

  // Convert BigInt safely
  const safeData: T = JSON.parse(
    JSON.stringify(data, (_: string, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value
    )
  ) as T;

  const responseBody = {
    statusCode,
    message,
    total,
    page,
    perPage,
    totalPages,
    data: safeData,
    ...additionalData,
  };

  return res.status(statusCode).json(responseBody);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "Unknown error occurred";
}

export function createErrorWithMessage(
  baseMessage: string,
  error?: unknown,
  statusCode = 400
): AppError {
  const errorMessage = error ? getErrorMessage(error) : "";
  const fullMessage = errorMessage
    ? `${baseMessage}: ${errorMessage}`
    : baseMessage;

  return new AppError(fullMessage, statusCode, error);
}

export class ServiceError extends Error {
  public statusCode: number; // explicitly public
  public payload?: string | object; // explicitly public

  public constructor(message: string | object, statusCode = 500) {
    super(typeof message === "string" ? message : JSON.stringify(message));
    this.statusCode = statusCode;
    this.payload = message;
    Object.setPrototypeOf(this, ServiceError.prototype);
  }
}

export class AppError extends Error {
  public statusCode: number;
  public details?: unknown;

  public constructor(message: string, statusCode = 400, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
