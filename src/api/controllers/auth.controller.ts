import { Request, Response } from "express";
import { AuthService } from "../../services/auth.service";
import {
  createErrorWithMessage,
  sendErrorResponse,
  sendSuccessResponse,
} from "../../utils/responseUtils";
import type {
  LoginRequestDTO,
  ExchangeTokenRequestDTO,
} from "../../types/dtos/auth.dto";
import logger from "../../utils/logger";

const authService = new AuthService();

export async function loginHandler(req: Request, res: Response) {
  try {
    const { auth_0_reference_id } = req.body as LoginRequestDTO;
    const result = await authService.login(auth_0_reference_id);
    return sendSuccessResponse(res, result);
  } catch (error: unknown) {
    throw createErrorWithMessage("Failed to login", error);
  }
}

export async function exchangeTokenHandler(req: Request, res: Response) {
  try {
    logger.info("Incoming request for exchangeTokenHandler: body=%o", req.body);
    const { code } = req.body as ExchangeTokenRequestDTO;
    if (!code)
      return sendErrorResponse(res, "Authorization code is required", 400);

    const origin = req.get("origin") ?? `${req.protocol}://${req.get("host")}`;
    const result = await authService.exchangeToken(code, origin);
    logger.info("Sending %d exchangetokenHandler in response", result);
    return sendSuccessResponse(res, result);
  } catch (error: unknown) {
    logger.error("Error in exchangeTokenHandler: %o", error);
    throw createErrorWithMessage("Failed to exchange token", error);
  }
}
