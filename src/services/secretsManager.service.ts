/**
 * AWS Secrets Manager Service
 *
 * This service handles loading secrets from AWS Secrets Manager
 * and setting them as environment variables for the application.
 *
 * @author kalyanrai
 * @version 1.0.0
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  SecretsManagerClientConfig,
} from "@aws-sdk/client-secrets-manager";

/**
 * Interface for AWS Secrets Manager configuration
 */
interface SecretsManagerConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  secretName: string;
}

/**
 * Interface for parsed secrets from AWS
 */
type ParsedSecrets = Record<string, string>;

/**
 * AWS Secrets Manager Service Class
 */
export class SecretsManagerService {
  private readonly client: SecretsManagerClient;
  private readonly config: SecretsManagerConfig;

  public constructor() {
    this.config = this.getConfig();
    this.client = this.createClient();
  }

  /**
   * Get AWS Secrets Manager configuration from environment variables
   * @returns SecretsManagerConfig object
   */
  private getConfig(): SecretsManagerConfig {
    // eslint-disable-next-line n/no-process-env
    const region = process.env.AWS_REGION;
    // eslint-disable-next-line n/no-process-env
    const accessKeyId =
      process.env.AWS_ACCESS_KEY_ID ?? process.env.AWS_accessKeyId;
    // eslint-disable-next-line n/no-process-env
    const secretAccessKey =
      process.env.AWS_SECRET_ACCESS_KEY ?? process.env.AWS_secretAccessKey;
    // eslint-disable-next-line n/no-process-env
    const secretName = process.env.AWS_SECRET_NAME;

    if (!region) {
      throw new Error("AWS_REGION environment variable is required");
    }
    if (!accessKeyId) {
      throw new Error(
        "AWS_ACCESS_KEY_ID or AWS_accessKeyId environment variable is required"
      );
    }
    if (!secretAccessKey) {
      throw new Error(
        "AWS_SECRET_ACCESS_KEY or AWS_secretAccessKey environment variable is required"
      );
    }
    if (!secretName) {
      throw new Error("AWS_SECRET_NAME environment variable is required");
    }

    return {
      region,
      accessKeyId,
      secretAccessKey,
      secretName,
    };
  }

  /**
   * Create AWS Secrets Manager client
   * @returns SecretsManagerClient instance
   */
  private createClient(): SecretsManagerClient {
    const clientConfig: SecretsManagerClientConfig = {
      region: this.config.region,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    };

    return new SecretsManagerClient(clientConfig);
  }

  /**
   * Load secrets from AWS Secrets Manager and set them as environment variables
   * @returns Promise<boolean> - true if successful, false otherwise
   */
  public async loadSecrets(): Promise<boolean> {
    try {
      // eslint-disable-next-line no-console
      console.log(
        `Loading secrets from AWS Secrets Manager: ${this.config.secretName}`
      );

      const command = new GetSecretValueCommand({
        SecretId: this.config.secretName,
        VersionStage: "AWSCURRENT",
      });

      const response = await this.client.send(command);

      if (!response.SecretString) {
        throw new Error("Secret not found or not in string format");
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const secrets: ParsedSecrets = JSON.parse(response.SecretString);

      // Set secrets to process.env
      for (const [key, value] of Object.entries(secrets)) {
        if (typeof value === "string") {
          // eslint-disable-next-line n/no-process-env
          process.env[key] = value;
        }
      }

      // eslint-disable-next-line no-console
      console.log("Successfully loaded secrets from AWS Secrets Manager");
      // eslint-disable-next-line no-console
      console.log(`Loaded ${Object.keys(secrets).length} secrets`);

      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error loading secrets from AWS Secrets Manager:", error);
      return false;
    }
  }

  /**
   * Get a specific secret value by key
   * @param key - The secret key to retrieve
   * @returns Promise<string | undefined> - The secret value or undefined if not found
   */
  public async getSecretValue(key: string): Promise<string | undefined> {
    try {
      const command = new GetSecretValueCommand({
        SecretId: this.config.secretName,
        VersionStage: "AWSCURRENT",
      });

      const response = await this.client.send(command);

      if (!response.SecretString) {
        throw new Error("Secret not found or not in string format");
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const secrets: ParsedSecrets = JSON.parse(response.SecretString);
      return secrets[key];
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Error retrieving secret value for key '${key}':`, error);
      return undefined;
    }
  }

  /**
   * Load web secrets from AWS Secrets Manager for API response
   * @returns Promise<ParsedSecrets> - The parsed secrets object
   */
  public async loadWebSecrets(): Promise<ParsedSecrets> {
    try {
      // eslint-disable-next-line n/no-process-env
      const webSecretName = process.env.AWS_WEB_SECRET_NAME;
      
      if (!webSecretName) {
        throw new Error("AWS_WEB_SECRET_NAME environment variable is required");
      }

      // eslint-disable-next-line no-console
      console.log(
        `Loading web secrets from AWS Secrets Manager: ${webSecretName}`
      );

      const command = new GetSecretValueCommand({
        SecretId: webSecretName,
        VersionStage: "AWSCURRENT",
      });

      const response = await this.client.send(command);

      if (!response.SecretString) {
        throw new Error("Secret not found or not in string format");
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const secrets: ParsedSecrets = JSON.parse(response.SecretString);

      // eslint-disable-next-line no-console
      console.log("Successfully fetched secrets from AWS Secrets Manager");
      
      return secrets;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching secrets from AWS:", (error as Error).message);
      throw error;
    }
  }

  /**
   * Check if secrets are enabled (AWS environment variables are set)
   * @returns boolean - true if secrets are enabled, false otherwise
   */
  public static isSecretsEnabled(): boolean {
    return !!(
      // eslint-disable-next-line n/no-process-env
      (
        process.env.AWS_REGION &&
        // eslint-disable-next-line n/no-process-env
        (process.env.AWS_ACCESS_KEY_ID ?? process.env.AWS_accessKeyId) &&
        // eslint-disable-next-line n/no-process-env
        (process.env.AWS_SECRET_ACCESS_KEY ??
          process.env.AWS_secretAccessKey) &&
        // eslint-disable-next-line n/no-process-env
        process.env.AWS_SECRET_NAME
      )
    );
  }
}

/**
 * Get singleton instance of SecretsManagerService (lazy initialization)
 */
let secretsManagerServiceInstance: SecretsManagerService | null = null;

export const getSecretsManagerService = (): SecretsManagerService => {
  secretsManagerServiceInstance ??= new SecretsManagerService();
  return secretsManagerServiceInstance;
};

/**
 * Utility function to load secrets from AWS Secrets Manager
 * This function can be called during application initialization
 * @returns Promise<boolean> - true if successful, false otherwise
 */
export const loadSecretsFromAWS = async (): Promise<boolean> => {
  if (!SecretsManagerService.isSecretsEnabled()) {
    // eslint-disable-next-line no-console
    console.log(
      "AWS Secrets Manager is not configured. Skipping secrets loading."
    );
    return true; // Not an error, just not configured
  }

  const service = getSecretsManagerService();
  return await service.loadSecrets();
};
