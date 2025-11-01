import { useQuery } from "@tanstack/react-query";
import { getTotalValuation } from "@/lib/api/valuation";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useTotalValuation() {
  const query = useQuery({
    queryKey: ["valuation", "total"],
    queryFn: () => getTotalValuation(),
    staleTime: 300_000,
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
