"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getAlerts, 
  getUnreadCount, 
  markAlertAsRead, 
  markAllAlertsAsRead,
  AlertsParams 
} from "@/lib/api/alerts";
import { ApiError } from "@/lib/api/client";
import { useEffect, useState } from "react";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useAlerts(params: AlertsParams) {
  const query = useQuery({
    queryKey: ["alerts", "list", params],
    queryFn: () => getAlerts(params),
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

export function useUnreadCount() {
  const [hasInitialData, setHasInitialData] = useState(false);
  
  const query = useQuery({
    queryKey: ["alerts", "unread-count"],
    queryFn: getUnreadCount,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  useEffect(() => {
    if (query.data !== undefined && !hasInitialData) {
      setHasInitialData(true);
    }
  }, [query.data, hasInitialData]);

  return {
    ...query,
    count: query.data?.count ?? 0,
    hasInitialData,
  };
}

export function useMarkAlertAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alertId: string) => markAlertAsRead(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useMarkAllAlertsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllAlertsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}
