import { RequestHandler } from "express";
import { auth } from "express-oauth2-jwt-bearer";

export const jwtCheck = auth({
  audience: "https://ten-customer-portal.com",
  issuerBaseURL: process.env.AUTH0_DOMAIN,
  tokenSigningAlg: "RS256",
});

declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      payload?: {
        scope?: string,
        permissions?: string[]
      },
      [key: string]: unknown
    };
    user?: { 
      customer_id?: number | string,
      user_id?: number,
      [key: string]: unknown
    }
  }
}

export const requirePermission = (
  requiredPermissions: string | string[]
): RequestHandler[] => {
  const checkPermission: RequestHandler = (req, res, next) => {
    const userPermissions: string[] = req.auth?.payload?.permissions ?? [];

    const requiredArray = Array.isArray(requiredPermissions)
      ? requiredPermissions
      : [requiredPermissions];

    // Check that user has *all* required permissions
    const hasAll = requiredArray.every((perm) =>
      userPermissions.includes(perm)
    );

    if (hasAll) return next();

    res.status(403).json({
      message: `Insufficient permissions. Required: ${requiredArray.join(
        ", "
      )}`,
    });
  };

  return [jwtCheck, checkPermission];
};
