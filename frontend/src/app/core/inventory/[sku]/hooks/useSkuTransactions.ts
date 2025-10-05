"use client";

import { useQuery } from "@tanstack/react-query";
import { getLatestTransactions } from "@/lib/api/inventory";

/**
 * useSkuTransactions()
 * Fetches the latest inventory transactions for a given SKU (and optional location).
 * Wraps React Query for caching, revalidation, and loading/error states.
 */
export function useSkuTransactions(skuId: string, location?: string) {
  const query = useQuery({
    queryKey: ["inventoryTransactions", skuId, location],
    queryFn: () => getLatestTransactions(skuId, location),
    enabled: !!skuId, // only fetch when skuId is available
    staleTime: 5 * 60_000, // cache for 5 minutes
    refetchOnWindowFocus: false,
  });

  // Derived metadata
  const hasData = Array.isArray(query.data) && query.data.length > 0;

  // If no location filter is provided, assume the SKU may exist across multiple locations
  const isMultiLocation = !location;

  return {
    ...query,
    data: query.data,
    hasData,
    isMultiLocation,
  };
}
