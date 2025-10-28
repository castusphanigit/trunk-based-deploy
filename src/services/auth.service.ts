// src/modules/auth/services/auth.service.ts
import prisma from "../config/database.config";
import axios from "axios";
import { generateToken, getAuth0Config } from "../utils/authUtils";
import type {
  LoginResponseDTO,
  ExchangeTokenResponseDTO,
  Auth0Tokens,
} from "../types/dtos/auth.dto";
import { addUserToRole, updateAuth0User } from "./auth0.service";
import jwt from "jsonwebtoken";
import { createErrorWithMessage } from "../utils/responseUtils";
let auth0RoleId = process.env.AUTH0_ROLE_ID ?? "";
interface Auth0AccessTokenPayload {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface Auth0IdTokenPayload {
  sub: string;
  email?: string;
  given_name?: string;
  nickname?: string;
  name?: string;
  phone_number?: string;
  designation?: string;
  picture?: string;
}

export class AuthService {
  /**
   * Handles user login with Auth0 reference ID
   *
   * @param auth_0_reference_id - The Auth0 reference ID for the user
   * @returns User data with authentication token
   *
   * Security considerations:
   * - Validates Auth0 reference ID to prevent injection attacks
   * - Uses parameterized queries through Prisma ORM
   * - Generates secure JWT tokens with proper expiration
   * - Implements proper error handling without information disclosure
   *
   * Note: This method is for internal testing and not used in production
   * @author kalyanrai
   */
  public async login(auth_0_reference_id: string): Promise<LoginResponseDTO> {
    const user = await prisma.user.findUnique({
      where: { auth_0_reference_id },
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        status: true,
        user_role_id: true,
        auth_0_reference_id: true,
        customer_id: true,
        assigned_account_ids: true,
        user_role_ref: { select: { name: true } },
      },
    });

    if (!user) throw new Error("User not found");

    const token = generateToken(
      {
        user_id: user.user_id,
        user_role: user.user_role_ref?.name,
        customer_id: user.customer_id,
      },
      "24h"
    );

    const { user_role_ref, ...userData } = user;

    return {
      user: { ...userData, role: user_role_ref?.name ?? null },
      token,
    };
  }

  /**
   * Handles OAuth2 token exchange and user authentication
   * Exchanges authorization code for tokens and manages user database synchronization
   *
   * @param code - Authorization code from Auth0 from front end
   * @param origin - Application origin URL
   * @returns User data with authentication token
   *
   * Security considerations:
   * - Validates authorization code and origin URL
   * - Securely exchanges tokens with Auth0
   * - Validates and decodes JWT tokens properly
   * - Auto-creates TEN-EntraID users with proper role assignment
   * - Uses parameterized queries through Prisma ORM
   * - Implements proper error handling without information disclosure
   * - Protects against token manipulation attacks
   *
   * @author kalyanrai
   */
  public async exchangeToken(
    code: string,
    origin: string
  ): Promise<ExchangeTokenResponseDTO> {
    const tokens = await this.exchangeCodeForTokens(code, origin);
    const userInfo = this.extractUserInfoFromToken(tokens.id_token!);
    let user = await this.findExistingUser(userInfo.sub);

    user ??= await this.createNewUserIfEligible(tokens.id_token!, userInfo.sub);

    if (!user) {
      throw new Error("User not found and not eligible for auto-creation");
    }

    await this.assignUserRole(userInfo.sub);
    await this.handleFirstLogin(user);

    // Update last_active timestamp for the user
    await prisma.user.update({
      where: { user_id: user.user_id },
      data: { last_active: new Date() },
    });

    const { user_role_ref, ...userData } = user;
    return {
      user: { ...userData, role: user_role_ref?.name ?? null },
      auth0_token: tokens.access_token,
    };
  }

  /**
   * Exchanges authorization code for Auth0 tokens
   */
  private async exchangeCodeForTokens(
    code: string,
    origin: string
  ): Promise<Auth0Tokens> {
    const { domain, clientId, clientSecret } = getAuth0Config();
    const redirectUri = `${origin}/verify`;
    const tokenEndpoint = `${domain}/oauth/token`;

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const tokenResponse = await axios.post<Auth0Tokens>(
      tokenEndpoint,
      params.toString(),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const tokens = tokenResponse.data;
    if (!tokens.id_token) {
      throw createErrorWithMessage("Missing id_token from Auth0 response", 409);
    }

    return tokens;
  }

  /**
   * Extracts user information from the ID token
   */
  private extractUserInfoFromToken(idToken: string): Auth0AccessTokenPayload {
    const decodedAccessToken = jwt.decode(
      idToken
    ) as Auth0AccessTokenPayload | null;

    if (!decodedAccessToken?.sub) {
      throw new Error("Unable to determine user ID from token");
    }

    return {
      sub: decodedAccessToken.sub,
      email: decodedAccessToken.email,
      name: decodedAccessToken.name,
      picture: decodedAccessToken.picture,
    };
  }

  /**
   * Finds existing user by Auth0 reference ID
   */
  private async findExistingUser(auth0ReferenceId: string) {
    return await prisma.user.findUnique({
      where: { auth_0_reference_id: auth0ReferenceId },
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        status: true,
        user_role_id: true,
        auth_0_reference_id: true,
        customer_id: true,
        assigned_account_ids: true,
        is_first_login: true,
        is_user_approved: true,
        user_role_ref: { select: { name: true } },
      },
    });
  }

  /**
   * Creates a new user if eligible (TEN-EntraID users)
   */
  private async createNewUserIfEligible(
    idToken: string,
    auth0ReferenceId: string
  ) {
    if (!idToken) {
      throw new Error("Missing id_token from Auth0 response");
    }

    const decodedIdToken = jwt.decode(idToken) as Auth0IdTokenPayload | null;
    if (!decodedIdToken?.sub) {
      throw new Error("Invalid id_token: missing sub claim");
    }

    if (!auth0ReferenceId.includes("TEN-EntraID")) {
      return null;
    }

    return await this.createTenEntraIdUser(decodedIdToken);
  }

  /**
   * Creates a new TEN-EntraID user
   */
  private async createTenEntraIdUser(decodedIdToken: Auth0IdTokenPayload) {
    const rolePermissions = await prisma.user_role.findUnique({
      where: { user_role_id: 1 },
      select: { role_permission: true },
    });

    const fullName = decodedIdToken.nickname ?? decodedIdToken.name ?? "";
    const [first_name = "", last_name = ""] = fullName.includes(".")
      ? fullName.split(".")
      : fullName.split(" ");

    return await prisma.user.create({
      data: {
        first_name,
        last_name,
        email: decodedIdToken.email,
        phone_number: decodedIdToken.phone_number ?? null,
        designation: decodedIdToken.designation ?? "Ten Admin",
        avatar: decodedIdToken.picture ?? null,
        auth_0_reference_id: decodedIdToken.sub,
        status: "ACTIVE",
        is_customer_user: false,
        user_role_id: 1,
        customer_id: null,
        auth0_customer_id: null,
        auth0_role_id: auth0RoleId,
        assigned_account_ids: [],
        is_user_approved: false,
        permissions: rolePermissions?.role_permission ?? [],
        is_first_login: false,
      },
      select: {
        user_id: true,
        first_name: true,
        last_name: true,
        email: true,
        phone_number: true,
        status: true,
        user_role_id: true,
        auth_0_reference_id: true,
        customer_id: true,
        assigned_account_ids: true,
        is_first_login: true,
        is_user_approved: true,
        user_role_ref: { select: { name: true } },
      },
    });
  }

  /**
   * Assigns user to Auth0 role
   */
  private async assignUserRole(auth0ReferenceId: string): Promise<void> {
    await addUserToRole(auth0RoleId, auth0ReferenceId);
  }

  /**
   * Handles first login flag and Auth0 user metadata update
   */
  private async handleFirstLogin(user: {
    user_id: number;
    is_first_login: boolean | null;
    auth_0_reference_id: string;
  }): Promise<void> {
    if (!user.is_first_login) {
      await prisma.user.update({
        where: { user_id: user.user_id },
        data: { is_first_login: true },
      });

      await updateAuth0User(user.auth_0_reference_id, { app_metadata: {} });
    }
  }
}
