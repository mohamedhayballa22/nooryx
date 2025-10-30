import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "@/lib/api/dashboard";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useDashboardSummary() {
  const query = useQuery({
    queryKey: ["inventory", "summary"],
    queryFn: getDashboardSummary,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const errorStatus = getErrorStatus(query.error);

  return {
    ...query,
    data: query.data,
    errorStatus,
  };
}
