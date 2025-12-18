import { apiClient } from "@/lib/api/client";

export interface InvitationAcceptRequest {
  token: string;
  first_name: string;
  last_name: string;
  password: string;
}

export interface InvitationAcceptResponse {
  email: string;
  org_name: string;
}

export interface InvitationTokenPayload {
  email: string;
  org_id: string;
  org_name: string;
  exp: number;
  iat: number;
}

export function decodeInvitationToken(token: string): InvitationTokenPayload {
  try {
    const base64Payload = token.split(".")[1];
    const payload = JSON.parse(atob(base64Payload));

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new Error("Invitation has expired");
    }

    return payload as InvitationTokenPayload;
  } catch (error) {
    if (error instanceof Error && error.message === "Invitation has expired") {
      throw error;
    }
    throw new Error("Invalid invitation token");
  }
}

export async function acceptInvitation(
  data: InvitationAcceptRequest
): Promise<InvitationAcceptResponse> {
  return apiClient<InvitationAcceptResponse>("/auth/join", {
    method: "POST",
    body: JSON.stringify(data),
    requiresAuth: false, // public endpoint
  });
}
