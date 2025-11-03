import { protectedApiClient } from "./protected-client";

export interface InvitePayload {
  email: string;
}

export async function sendInvite(payload: InvitePayload): Promise<void> {
  await protectedApiClient("/auth/invite", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
