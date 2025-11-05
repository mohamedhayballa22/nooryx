import { protectedApiClient } from "../protected-client";

export interface InvitePayload {
  email: string;
}

export interface TeamMember {
  first_name: string;
  last_name: string;
  email: string;
  role?: string | null;
}

export async function sendInvite(payload: InvitePayload): Promise<void> {
  await protectedApiClient("/auth/invite", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  return protectedApiClient<TeamMember[]>("/team/members", {
    method: "GET",
  });
}
