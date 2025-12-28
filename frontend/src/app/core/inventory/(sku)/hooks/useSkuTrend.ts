"use client";

import { useQuery } from "@tanstack/react-query";
import { getInventoryTrend } from "@/lib/api/inventory";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useSkuTrend(
  skuId: string,
  location?: string,
  period: string = "31d",
) {
  const query = useQuery({
    queryKey: ["trend", skuId, period, location],
    queryFn: () => getInventoryTrend(skuId, period, location),
    enabled: !!skuId,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    placeholderData: (previousData) => previousData,
  });

  const hasData = Array.isArray(query.data?.points) && query.data.points.length > 0;
  const isMultiLocation = query.data?.location === null;
  const errorStatus = getErrorStatus(query.error);

  return {
    ...query,
    data: query.data,
    hasData,
    isMultiLocation,
    errorStatus,
  };
}
