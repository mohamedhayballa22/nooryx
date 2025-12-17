import { useMutation } from "@tanstack/react-query";
import {
  joinWaitlist,
  WaitlistJoinRequest,
  WaitlistJoinResponse,
} from "@/lib/api/waitlist";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useJoinWaitlist() {
  const mutation = useMutation<
    WaitlistJoinResponse,
    ApiError,
    WaitlistJoinRequest
  >({
    mutationFn: joinWaitlist,
    retry: false,
  });

  const errorStatus = getErrorStatus(mutation.error);

  return {
    ...mutation,
    errorStatus,
  };
}
