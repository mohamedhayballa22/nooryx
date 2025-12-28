"use client";

import { useQuery } from "@tanstack/react-query";
import { getInventoryBySku } from "@/lib/api/inventory";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useSku(sku: string, location?: string) {
  const query = useQuery({
    queryKey: ["inventory", sku, location],
    queryFn: () => getInventoryBySku(sku, location),
    enabled: !!sku,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
    placeholderData: (previousData) => previousData,
  });

  const hasData = !!query.data;
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
