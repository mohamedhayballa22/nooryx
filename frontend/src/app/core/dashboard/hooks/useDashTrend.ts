"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashInventoryTrend } from "@/lib/api/dashboard";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useDashInventoryTrend(
  location?: string,
  period: string = "30d",
) {
  const query = useQuery({
    queryKey: ["inventory", "trend", period, location],
    queryFn: () => getDashInventoryTrend(period, location),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
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
