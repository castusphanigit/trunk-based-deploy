import jwt, { Secret, SignOptions } from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as Secret;

/**
 * Generates a JWT token
 */
export function generateToken(
  payload: object,
  expiresIn: string | number = "24h"
): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn } as SignOptions);
}

/**
 * Verifies and decodes a JWT token
 */
export const verifyToken = (token: string) => {
  let response: unknown;
  let error: { name: string, message: string } = { name: "", message: "" };
  try {
    response = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    error = {
      name: "authentication error",
      message: (err as Error)?.message,
    };
  }
  return { response, error };
};

export function normalizeDomain(domain: string): string {
  let normalized = domain.startsWith("http") ? domain : `https://${domain}`;
  normalized = normalized.replace(/\/$/, "");
  return normalized;
}

export function getAuth0Config() {
  const domainEnv = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  const redirectUri = process.env.AUTH0_REDIRECT_URI;

  if (!domainEnv || !clientId || !clientSecret || !redirectUri) {
    throw new Error("One or more Auth0 environment variables are missing");
  }

  return {
    domain: normalizeDomain(domainEnv),
    clientId,
    clientSecret,
    redirectUri,
  };
}
