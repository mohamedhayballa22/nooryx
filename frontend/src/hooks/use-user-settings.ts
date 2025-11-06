import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserSettings, updateUserSettings } from "@/lib/api/settings/general";
import { ApiError } from "@/lib/api/client";

export const USER_SETTINGS_QUERY_KEY = ["settings", "general"];

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useUserSettings() {
  const query = useQuery({
    queryKey: USER_SETTINGS_QUERY_KEY,
    queryFn: getUserSettings,
    staleTime: 5 * 60_000, // 5 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const hasData = !!query.data;
  const errorStatus = getErrorStatus(query.error);

  return {
    ...query,
    settings: query.data,
    hasData,
    errorStatus,
  };
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateUserSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"]});
    },
  });
}
