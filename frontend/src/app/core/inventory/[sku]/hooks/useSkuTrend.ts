"use client";

import { useQuery } from "@tanstack/react-query";
import { getInventoryTrend } from "@/lib/api/inventory";

/**
 * useSkuTrend()
 * Fetches inventory trend data for a given SKU (and optional location).
 * Wraps React Query for caching, revalidation, and loading/error states.
 */
export function useSkuTrend(
  skuId: string,
  period: string = "30d",
  location?: string
) {
  const query = useQuery({
    queryKey: ["inventoryTrend", skuId, period, location],
    queryFn: () => getInventoryTrend(skuId, period, location),
    enabled: !!skuId, // only fetch when skuId is available
    staleTime: 5 * 60_000, // cache for 5 min
    refetchOnWindowFocus: false,
  });

  // Derived metadata
  const hasData = Array.isArray(query.data?.points) && query.data.points.length > 0;

const isMultiLocation = query.data?.location === null;

  return {
    ...query,
    data: query.data,
    hasData,
    isMultiLocation
  };
}
