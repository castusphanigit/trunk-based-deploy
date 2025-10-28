 
/**
 * Environment Configuration
 *
 * Centralized environment variable management with type safety
 * and validation to prevent runtime errors and improve maintainability.
 *
 * @author kalyanrai
 * @version 1.0.0
 */

/**
 * Get CORS allowed origins from environment variables
 * @returns Array of allowed origins or wildcard for development
 */
export const getCorsOrigins = (): string | string[] => {
  const origins = process.env.ALLOWED_ORIGINS;
  if (!origins) return "*";
  return origins.split(",").map((origin) => origin.trim());
};

/**
 * Check if the application is running in development mode
 * @returns true if in development mode, false otherwise
 */
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === "development";
};

/**
 * Get Auth0 domain from environment variables
 * @returns Auth0 domain string
 */
export const getAuth0Domain = (): string => {
  const domain = process.env.AUTH0_DOMAIN;
  if (!domain) {
    throw new Error("AUTH0_DOMAIN environment variable is required");
  }
  return domain.replace(/\/$/, "");
};

/**
 * Get Auth0 audience from environment variables
 * @returns Auth0 audience string
 */
export const getAuth0Audience = (): string => {
  const audience = process.env.AUTH0_AUDIENCE;
  if (!audience) {
    throw new Error("AUTH0_AUDIENCE environment variable is required");
  }
  return audience;
};

/**
 * Get Auth0 issuer from environment variables
 * @returns Auth0 issuer string
 */
export const getAuth0Issuer = (): string => {
  const issuer = process.env.AUTH0_ISSUER;
  if (!issuer) {
    throw new Error("AUTH0_ISSUER environment variable is required");
  }
  return issuer;
};

/**
 * Get database URL from environment variables
 * @returns Database URL string
 */
export const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL environment variable is required");
  }
  return url;
};

/**
 * Get SendGrid API key from environment variables
 * @returns SendGrid API key string
 */
export const getSendGridApiKey = (): string => {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    throw new Error("SENDGRID_API_KEY environment variable is required");
  }
  return apiKey;
};

/**
 * Get SendGrid from email from environment variables
 * @returns SendGrid from email string
 */
export const getSendGridFromEmail = (): string => {
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;
  if (!fromEmail) {
    throw new Error("SENDGRID_FROM_EMAIL environment variable is required");
  }
  return fromEmail;
};

/**
 * Get port number from environment variables
 * @returns Port number (defaults to 3000)
 */
export const getPort = (): number => {
  const port = process.env.PORT;
  return port ? parseInt(port, 10) : 3000;
};

/**
 * Get JWT secret from environment variables
 * @returns JWT secret string
 */
export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return secret;
};

/**
 * Get rate limit configuration from environment variables
 * @returns Rate limit configuration object
 */
export const getRateLimitConfig = () => {
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? "900000", 10); // 15 minutes default
  const maxRequests = parseInt(
    process.env.RATE_LIMIT_MAX_REQUESTS ?? "100",
    10
  ); // 100 requests default

  return {
    windowMs,
    maxRequests,
    retryAfterMinutes: Math.ceil(windowMs / 1000 / 60),
  };
};

/**
 * Get environment name from environment variables
 * @returns Environment name (defaults to "production")
 */
export const getEnvironment = (): string => {
  return process.env.ENVIRONMENT ?? "production";
};

/**
 * Get AWS region from environment variables
 * @returns AWS region string
 */
export const getAWSRegion = (): string => {
  const region = process.env.AWS_REGION;
  if (!region) {
    throw new Error("AWS_REGION environment variable is required");
  }
  return region;
};

/**
 * Get AWS access key ID from environment variables
 * @returns AWS access key ID string
 */
export const getAWSAccessKeyId = (): string => {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID ?? process.env.AWS_accessKeyId;
  if (!accessKeyId) {
    throw new Error("AWS_ACCESS_KEY_ID or AWS_accessKeyId environment variable is required");
  }
  return accessKeyId;
};

/**
 * Get AWS secret access key from environment variables
 * @returns AWS secret access key string
 */
export const getAWSSecretAccessKey = (): string => {
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY ?? process.env.AWS_secretAccessKey;
  if (!secretAccessKey) {
    throw new Error("AWS_SECRET_ACCESS_KEY or AWS_secretAccessKey environment variable is required");
  }
  return secretAccessKey;
};

/**
 * Get AWS secret name from environment variables
 * @returns AWS secret name string
 */
export const getAWSSecretName = (): string => {
  const secretName = process.env.AWS_SECRET_NAME;
  if (!secretName) {
    throw new Error("AWS_SECRET_NAME environment variable is required");
  }
  return secretName;
};

/**
 * Get AWS web secret name from environment variables
 * @returns AWS web secret name string
 */
export const getAWSWebSecretName = (): string => {
  const webSecretName = process.env.AWS_WEB_SECRET_NAME;
  if (!webSecretName) {
    throw new Error("AWS_WEB_SECRET_NAME environment variable is required");
  }
  return webSecretName;
};

/**
 * Check if AWS Secrets Manager is enabled
 * @returns true if all required AWS environment variables are set
 */
export const isAWSSecretsEnabled = (): boolean => {
  return !!(
    process.env.AWS_REGION &&
    (process.env.AWS_ACCESS_KEY_ID ?? process.env.AWS_accessKeyId) &&
    (process.env.AWS_SECRET_ACCESS_KEY ?? process.env.AWS_secretAccessKey) &&
    process.env.AWS_SECRET_NAME
  );
};

/**
 * Check if AWS Web Secrets Manager is enabled
 * @returns true if all required AWS environment variables are set including web secret name
 */
export const isAWSWebSecretsEnabled = (): boolean => {
  return !!(
    process.env.AWS_REGION &&
    (process.env.AWS_ACCESS_KEY_ID ?? process.env.AWS_accessKeyId) &&
    (process.env.AWS_SECRET_ACCESS_KEY ?? process.env.AWS_secretAccessKey) &&
    process.env.AWS_WEB_SECRET_NAME
  );
};