"use client";

import { useQuery } from "@tanstack/react-query";
import { getTransactions, TransactionsParams } from "@/lib/api/inventory";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useAuditTrail(params: TransactionsParams) {
  const query = useQuery({
    queryKey: ["transactions", params],
    queryFn: () => getTransactions(params),
    staleTime: 2 * 60_000, // 2 minutes
    refetchOnWindowFocus: false,
    retry: false,
  });

  const errorStatus = getErrorStatus(query.error);

  return {
    ...query,
    items: query.data?.items ?? [],
    totalPages: query.data?.pages ?? 0,
    totalItems: query.data?.total ?? 0,
    errorStatus,
  };
}
