import { apiClient } from "@/lib/api/client";

export interface WaitlistJoinRequest {
  email: string;
}

export interface WaitlistJoinResponse {
  email: string;
  created_at: string;
}

export async function joinWaitlist(
  data: WaitlistJoinRequest
): Promise<WaitlistJoinResponse> {
  return apiClient<WaitlistJoinResponse>("/waitlist", {
    method: "POST",
    body: JSON.stringify(data),
    requiresAuth: false, // public endpoint
  });
}
