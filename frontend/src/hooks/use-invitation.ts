import { useMutation } from "@tanstack/react-query";
import {
  acceptInvitation,
  decodeInvitationToken,
  InvitationAcceptRequest,
  InvitationAcceptResponse,
  InvitationTokenPayload,
} from "@/lib/api/invitation";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function parseInvitationToken(
  token: string | null
): {
  data: InvitationTokenPayload | null;
  error: string | null;
} {
  if (!token) {
    return { data: null, error: "Missing invitation token" };
  }

  try {
    return {
      data: decodeInvitationToken(token),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Invalid invitation token",
    };
  }
}

export function useAcceptInvitation() {
  const mutation = useMutation<
    InvitationAcceptResponse,
    ApiError,
    InvitationAcceptRequest
  >({
    mutationFn: acceptInvitation,
    retry: false,
  });

  const errorStatus = getErrorStatus(mutation.error);

  return {
    ...mutation,
    errorStatus,
  };
}
