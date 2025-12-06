import { useQuery } from "@tanstack/react-query";
import { getCOGS, COGSParams } from "@/lib/api/valuation";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useCOGS(period: string, params?: COGSParams) {
  const query = useQuery({
    queryKey: ["valuation", "cogs", period],
    queryFn: () => getCOGS(params),
    staleTime: 120_000,
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
