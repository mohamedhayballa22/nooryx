import { useQuery } from "@tanstack/react-query";
import { getDashboardMetrics } from "@/lib/api/dashboard";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useDashbaordMetrics(location?: string) {
  const query = useQuery({
    queryKey: ["inventory", "metrics", location],
    queryFn: () => getDashboardMetrics(location),
    staleTime: 60_000,
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