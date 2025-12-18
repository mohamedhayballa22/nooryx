import { protectedApiClient } from "../protected-client";

export interface UserAccount {
  first_name: string;
  last_name: string;
  email: string;
  role: string | null;
  created_at: string;
}

export interface Organization {
  name: string;
  created_at: string;
}

export interface SessionInfo {
  id: string;
  device_info: string | null;
  ip_address: string | null;
  last_used_at: string | null;
  expires_at: string;
  is_current: boolean;
}

export interface Subscription {
  plan_name: string
  status: string
  billing_frequency: string
  current_period_end: string
}

export interface UserAccountResponse {
  user: UserAccount;
  organization: Organization;
  subscription: Subscription;
  sessions: SessionInfo[];
}

export async function getUserAccount(): Promise<UserAccountResponse> {
  return protectedApiClient<UserAccountResponse>("/settings/account", {
    method: "GET",
  });
}

export async function deleteSession(
  session_id: string
): Promise<void> {
  await protectedApiClient(`/auth/sessions/${session_id}`, {
    method: "DELETE",
  });
}

export async function deleteAccount(): Promise<void> {
  await protectedApiClient("/settings/account", {
    method: "DELETE",
  });
}
