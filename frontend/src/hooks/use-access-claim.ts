import { useMutation } from "@tanstack/react-query";
import {
  claimAccess,
  decodeAccessToken,
  AccessClaimRequest,
  AccessClaimResponse,
  AccessTokenPayload,
} from "@/lib/api/access-claim";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function parseAccessToken(
  token: string | null
): {
  data: AccessTokenPayload | null;
  error: string | null;
} {
  if (!token) {
    return { data: null, error: "Missing access token" };
  }

  try {
    return {
      data: decodeAccessToken(token),
      error: null,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Invalid access token",
    };
  }
}

export function useClaimAccess() {
  const mutation = useMutation
    <AccessClaimResponse,
    ApiError,
    AccessClaimRequest
  >({
    mutationFn: claimAccess,
    retry: false,
  });

  const errorStatus = getErrorStatus(mutation.error);

  return {
    ...mutation,
    errorStatus,
  };
}
