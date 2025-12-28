import { useQuery } from "@tanstack/react-query";
import { getTopMovers } from "@/lib/api/dashboard";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useTopMovers(location?: string, period: string = "7d") {
  const query = useQuery({
    queryKey: ["inventory", "top-movers", location, period],
    queryFn: () => getTopMovers(location, period),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    placeholderData: (previousData) => previousData,
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
