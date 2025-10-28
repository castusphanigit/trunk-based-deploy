import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

interface Auth0TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number
}

interface Auth0ErrorResponse {
  error?: string;
  error_description?: string
}

export async function getManagementToken(): Promise<string> {
  try {
    const auth0Domain = process.env.AUTH0_DOMAIN;
    if (!auth0Domain) {
      throw new Error("AUTH0_DOMAIN environment variable is not set");
    }

    const response = await axios.post<Auth0TokenResponse>(
      `${auth0Domain}/oauth/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.AUTH0_CLIENT_ID ?? "",
        client_secret: process.env.AUTH0_CLIENT_SECRET ?? "",
        audience: `${auth0Domain}/api/v2/`,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    if (!response.data.access_token) {
      throw new Error("No access token returned from Auth0");
    }

    return response.data.access_token;
  } catch (error: unknown) {
    let errorMessage = "Failed to get Auth0 token";

    if (axios.isAxiosError(error)) {
      const errorData = error.response?.data as Auth0ErrorResponse;
      const errorDetails = errorData?.error_description ?? error.message;
      errorMessage = errorDetails;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
}
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

// Helper: Retry wrapper with exponential backoff for 429 errors

export const axiosWithRetry = async <T = unknown>(
  config: AxiosRequestConfig,
  retries = 3,
  delay = 500
): Promise<T> => {
  let attempt = 0;
  let lastError: Error | undefined;

  while (attempt <= retries) {
    try {
      const response: AxiosResponse<T> = await axios(config);
      return response.data;
    } catch (err: unknown) {
      attempt++;

      // Convert to proper Error object
      if (err instanceof Error) {
        lastError = err;
      } else if (axios.isAxiosError(err)) {
        // For Axios errors, we can use the error message or create a new Error
        lastError = new Error(err.message);
      } else {
        // Handle unknown error types
        lastError = new Error("Unknown error occurred");
      }

      if (attempt > retries) {
        throw lastError; // Now throwing a proper Error object
      }

      // exponential backoff
      const backoff = delay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  throw lastError ?? new Error("Request failed after retries");
};
