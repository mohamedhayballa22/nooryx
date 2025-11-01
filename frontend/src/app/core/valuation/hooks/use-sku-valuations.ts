import { useQuery } from "@tanstack/react-query";
import { getSKUValuations } from "@/lib/api/valuation";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useSKUValuations(page: number, size: number) {
  const query = useQuery({
    queryKey: ["valuation", "skus", page, size],
    queryFn: () => getSKUValuations({ page: page + 1, size }),
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
