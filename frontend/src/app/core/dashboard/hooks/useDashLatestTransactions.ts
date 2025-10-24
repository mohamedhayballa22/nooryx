import { useQuery } from "@tanstack/react-query";
import { getDashLatestTransactions } from "@/lib/api/dashboard";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useDashLatestTransactions(location?: string) {
  const query = useQuery({
    queryKey: ["transactions", "latest", location],
    queryFn: () => getDashLatestTransactions(location),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const hasData = !!query.data;
  const hasTransactions = (query.data?.transactions?.length ?? 0) > 0;
  const errorStatus = getErrorStatus(query.error);

  return {
    ...query,
    data: query.data,
    hasData,
    hasTransactions,
    errorStatus,
  };
}
