import { apiClient } from "@/lib/api/client";

export interface AccessClaimRequest {
  token: string;
  email: string;
  first_name: string;
  last_name: string;
  password: string;
  company_name: string;
  valuation_method: "FIFO" | "LIFO" | "WAC";
  currency: string;
}

export interface AccessClaimResponse {
  org_id: string;
  user_id: string;
  email: string;
  org_name: string;
  subscription_end_date: string;
}

export interface AccessTokenPayload {
  email: string;
  subscription_months: number;
  exp: number;
  iat: number;
}

export function decodeAccessToken(token: string): AccessTokenPayload {
  try {
    const base64Payload = token.split(".")[1];
    const payload = JSON.parse(atob(base64Payload));

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new Error("Access token has expired");
    }

    return payload as AccessTokenPayload;
  } catch (error) {
    if (error instanceof Error && error.message === "Access token has expired") {
      throw error;
    }
    throw new Error("Invalid access token");
  }
}

export async function claimAccess(
  data: AccessClaimRequest
): Promise<AccessClaimResponse> {
  return apiClient<AccessClaimResponse>("/access/claim", {
    method: "POST",
    body: JSON.stringify(data),
    requiresAuth: false, // public endpoint
  });
}
