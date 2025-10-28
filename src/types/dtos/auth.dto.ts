// src/modules/auth/dtos/auth.dto.ts

export interface LoginRequestDTO {
  auth_0_reference_id: string
}

// src/modules/auth/dtos/auth.dto.ts

export interface LoginResponseDTO {
  user: {
    user_id: number,
    first_name: string | null,
    last_name: string | null,
    email: string | null,
    phone_number: string | null,
    status: string,
    customer_id: number | null,
    assigned_account_ids: number[],
    role: string | null
  };
  token: string
}

export interface ExchangeTokenRequestDTO {
  code: string
}

export interface ExchangeTokenResponseDTO {
  user: LoginResponseDTO["user"];

  auth0_token: string
}


export interface Auth0Tokens {
  access_token: string;
  id_token?: string;
  scope?: string;
  expires_in: number;
  token_type: string
}

export interface UserInfo {
  sub: string;
  email?: string;
  name?: string;
  picture?: string
  // [key: string]: any;
}

export interface DecodedToken {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
  given_name?: string;
  nickname?: string;
  phone_number?: string;
  designation?: string
  // Add other decoded token properties
}
