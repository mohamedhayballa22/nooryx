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

export interface UserAccountResponse {
  user: UserAccount;
  organization: Organization;
  sessions: SessionInfo[];
}

export async function getUserAccount(): Promise<UserAccountResponse> {
  return protectedApiClient<UserAccountResponse>("/settings/account", {
    method: "GET",
  });
}
