/**
 * Application Initializer
 * 
 * This module handles the initialization sequence for the application,
 * including loading secrets from AWS Secrets Manager before starting the app.
 * 
 * @author kalyanrai
 * @version 1.0.0
 */

import dotenv from "dotenv";
import { loadSecretsFromAWS } from "../services/secretsManager.service";
import { isAWSSecretsEnabled } from "./env.config";

/**
 * Initialize the application by loading environment variables and secrets
 * @returns Promise<void>
 */
export const initializeApp = async (): Promise<void> => {
  try {
    // eslint-disable-next-line no-console
    console.log("Starting application initialization...");
    
    // Load environment variables from .env file first
    dotenv.config();
    // eslint-disable-next-line no-console
    console.log("Environment variables loaded from .env file");

    // Check if AWS Secrets Manager is configured
    if (isAWSSecretsEnabled()) {
      // eslint-disable-next-line no-console
      console.log("AWS Secrets Manager configuration detected");
      
      // Load secrets from AWS Secrets Manager
      const secretsLoaded = await loadSecretsFromAWS();
      
      if (!secretsLoaded) {
        // eslint-disable-next-line no-console
        console.warn("Failed to load secrets from AWS Secrets Manager, continuing with existing environment variables");
      }
    } else {
      // eslint-disable-next-line no-console
      console.log("AWS Secrets Manager not configured, using environment variables only");
    }

    // eslint-disable-next-line no-console
    console.log("Application initialization completed successfully");
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error during application initialization:", error);
    throw error;
  }
};

/**
 * Initialize the application and handle any errors
 * This function should be called before starting the Express app
 */
export const initializeAppWithErrorHandling = async (): Promise<void> => {
  try {
    await initializeApp();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Failed to initialize application:", error);
    throw error;
  }
};
