import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { deleteSession, getUserAccount, deleteAccount } from "@/lib/api/settings/account";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useUserAccount() {
  const query = useQuery({
    queryKey: ["settings", "account"],
    queryFn: getUserAccount,
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    retry: false,
  });

  const hasData = !!query.data;
  const errorStatus = getErrorStatus(query.error);

  return {
    ...query,
    data: query.data,
    hasData,
    errorStatus,
  };
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (session_id: string) => deleteSession(session_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "account"]});
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      // Clear all cached data since the account is deleted
      queryClient.clear();
    },
  });
}
