/* eslint-disable @stylistic/ts/member-delimiter-style */
import { getManagementToken } from "../utils/auth0.managementtoken";
import axios, { AxiosResponse } from "axios";
import logger from "../utils/logger";
import { getAuth0Domain } from "../config/env.config";

import { Auth0User } from "../../src/types/dtos/user.dto";

const domain = getAuth0Domain();

interface Auth0TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  // Add other possible properties if needed
}

interface Auth0ErrorResponse {
  error: string;
  error_description: string;
  // Add other possible properties if needed
}

if (!domain) {
  throw new Error("AUTH0_DOMAIN is not defined in environment variables");
}

/**
 * Create user in Auth0
 */

export const createAuth0User = async (
  payload: Record<string, unknown>
): Promise<Auth0User> => {
  const token = await getManagementToken();

  const res = await axios.post<Auth0User>(
    `${domain}/api/v2/users`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.data;
};
/**
 * Update user in Auth0
 */
export const updateAuth0User = async (
  auth0UserId: string,
  payload: Record<string, unknown>
): Promise<Auth0User> => {
  const token = await getManagementToken();

  const res = await axios.patch<Auth0User>(
    `${domain}/api/v2/users/${encodeURIComponent(
      auth0UserId
    )}`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return res.data;
};

/**
 * Delete user in Auth0
 */
export const deleteAuth0User = async (auth0UserId: string) => {
  const token = await getManagementToken();
  await axios.delete(
    `${domain}/api/v2/users/${encodeURIComponent(auth0UserId)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

/**
 * Add user to an Auth0 organization
 */
export const addUserToOrganization = async (orgId: string, userId: string) => {
  const token = await getManagementToken();
  await axios.post(
    `${domain}/api/v2/organizations/${orgId}/members`,
    { members: [userId] },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
};

export const addUserToRole = async (roleId: string, userId: string) => {
  const token = await getManagementToken();

  // Clean up roleId and userId just in case - remove leading and trailing quotes safely
  const cleanRoleId = (() => {
    let result = roleId.trim();
    while (result.startsWith('"')) result = result.substring(1);
    while (result.endsWith('"')) result = result.slice(0, -1);
    return result;
  })();
  const cleanUserId = (() => {
    let result = userId.trim();
    while (result.startsWith('"')) result = result.substring(1);
    while (result.endsWith('"')) result = result.slice(0, -1);
    return result;
  })();

  await axios.post(
    `${domain}/api/v2/roles/${cleanRoleId}/users`,
    { users: [cleanUserId] },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }
  );
};


/**
 *
 * @returns  getAUth token getAuthToken
 */

export async function getAuthToken(): Promise<string> {
  try {
    const response = await axios.post<Auth0TokenResponse>(
      `${domain}/oauth/token`,
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.AUTH0_CLIENT_ID ?? "",
        client_secret: process.env.AUTH0_CLIENT_SECRET ?? "",
        audience: `${domain}/api/v2/`,
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

      errorMessage = errorData?.error_description || error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    throw new Error(errorMessage);
  }
}

interface ResourceServer {
  id: string;
  identifier: string;
  name: string;
  scopes?: {
    value: string;
    description: string;
  }[];
}

interface ResourceServerCreateResponse extends ResourceServer {
  signing_alg: string;
}

interface Scope {
  value: string;
  description: string;
}

interface CreateResourceServerRequest {
  name: string;
  identifier: string;
  signing_alg: string;
  scopes: Scope[];
}

interface UpdateResourceServerRequest {
  scopes: Scope[];
}

export async function ensureResourceServerExists(
  domain: string,
  token: string,
  identifier: string,
  permissions: string[]
): Promise<ResourceServer> {
  // Check existing APIs
  const listApis = await axios.get<ResourceServer[]>(
    `${domain}/api/v2/resource-servers`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  const existingApi = listApis.data.find(
    (api: ResourceServer) => api.identifier === identifier
  );

  if (!existingApi) {
    logger.info(`Creating new resource server: ${identifier}`);

    // Create API
    const newApi = await axios.post<ResourceServerCreateResponse>(
      `${domain}/api/v2/resource-servers`,
      {
        name: (() => {
          if (identifier.startsWith('http://')) {
            return identifier.substring(7);
          }
          if (identifier.startsWith('https://')) {
            return identifier.substring(8);
          }
          return identifier;
        })(), // remove protocol for name
        identifier: identifier,
        signing_alg: "RS256",
        scopes: permissions.map((p) => ({ value: p, description: p })),
      } as CreateResourceServerRequest,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    return newApi.data;
  } else {
    // Add missing scopes if needed
    const missingScopes = permissions.filter(
      (p) => !existingApi.scopes?.some((scope: Scope) => scope.value === p)
    );

    if (missingScopes.length > 0) {
      logger.info(`Adding missing scopes to API: ${identifier}`);

      const updatedScopes: Scope[] = [
        ...(existingApi.scopes ?? []),
        ...missingScopes.map((p) => ({ value: p, description: p })),
      ];

      const updateResponse = await axios.patch<ResourceServer>(
        `${domain}/api/v2/resource-servers/${existingApi.id}`,
        {
          scopes: updatedScopes,
        } as UpdateResourceServerRequest,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      return updateResponse.data;
    }

    return existingApi;
  }
}

///update user status

export const updateAuth0UserStatus = async (
  auth0UserId: string,
  isActive: boolean
): Promise<Record<string, unknown>> => {
  const token = await getManagementToken();

  const res: AxiosResponse<Record<string, unknown>> = await axios.patch(
    `${domain}/api/v2/users/${encodeURIComponent(auth0UserId)}`,
    { blocked: !isActive },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    }
  );

  return res.data;
};

 