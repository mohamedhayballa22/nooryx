import { adminApiClient } from "@/lib/api/adminClient";
import { useMutation } from "@tanstack/react-query";

export interface GrantAccessPayload {
  email: string;
  subscription_months: number;
}

export async function grantAccess(payload: GrantAccessPayload): Promise<void> {
  await adminApiClient("/admin/access/grant", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function useGrantAccess() {
  return useMutation({
    mutationFn: (payload: GrantAccessPayload) => grantAccess(payload),
  });
}
