"use client";

import { useQuery } from "@tanstack/react-query";
import { getInventoryBySku } from "@/lib/api/inventory";

/**
 * Custom hook for fetching SKU inventory data (and derived metadata)
 * - Fetches data from /inventory/{sku}
 * - Automatically re-fetches when location changes
 * - Computes isMultiLocation based on the API response
 */
export function useSku(skuId: string, location?: string) {
  const query = useQuery({
    queryKey: ["inventory", skuId, location],
    queryFn: () => getInventoryBySku(skuId, location),
    enabled: !!skuId, // don't fetch until we have an SKU
    staleTime: 60_000, // cache for 1 minute
    refetchOnWindowFocus: false, // optional UX tweak
  });

  const hasData = !!query.data;
  const isMultiLocation = query.data?.location === null;

  return {
    ...query,
    data: query.data,
    hasData,
    isMultiLocation,
  };
}
