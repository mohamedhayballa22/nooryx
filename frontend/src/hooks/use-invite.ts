import { useMutation } from "@tanstack/react-query";
import { sendInvite, type InvitePayload } from "@/lib/api/team";

export function useInvite() {
  return useMutation({
    mutationFn: (payload: InvitePayload) => sendInvite(payload),
  });
}
