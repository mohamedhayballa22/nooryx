"use client";

import { useQuery } from "@tanstack/react-query";
import { getLatestTransactionsBySku } from "@/lib/api/inventory";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useSkuTransactions(skuId: string, location?: string) {
  const query = useQuery({
    queryKey: ["inventoryTransactions", skuId, location],
    queryFn: () => getLatestTransactionsBySku(skuId, location),
    enabled: !!skuId,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const hasData = Array.isArray(query.data) && query.data.length > 0;
  const isMultiLocation = !location;
  const errorStatus = getErrorStatus(query.error);

  return {
    ...query,
    data: query.data,
    hasData,
    isMultiLocation,
    errorStatus,
  };
}
