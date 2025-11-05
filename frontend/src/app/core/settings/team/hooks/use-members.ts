import { useQuery } from "@tanstack/react-query";
import { getTeamMembers } from "@/lib/api/settings/team";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useTeamMembers() {
  const query = useQuery({
    queryKey: ["team", "members"],
    queryFn: getTeamMembers,
    staleTime: 60 * 60 * 1000, // 1 hour
    refetchOnWindowFocus: false,
    retry: false,
  });

  const hasData = !!query.data && query.data.length > 0;
  const errorStatus = getErrorStatus(query.error);

  return {
    ...query,
    data: query.data,
    hasData,
    errorStatus,
  };
}
