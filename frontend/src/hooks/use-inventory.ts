"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PaginationState } from "@tanstack/react-table";
import { getInventoryList, InventoryListParams } from "@/lib/api/inventory";
import { ApiError } from "@/lib/api/client";
import { useDebounce } from "@/hooks/use-debounce";

const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: 10 };
const INITIAL_STATUS_FILTERS = ["In Stock", "Low Stock", "Out of Stock"];

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

function areArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((val, idx) => val === sortedB[idx]);
}

export function useInventoryList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFirstRender = useRef(true);

  // Initialize state from URL or defaults
  const [pagination, setPagination] = useState<PaginationState>(() => {
    const page = searchParams.get("page");
    const size = searchParams.get("size");
    return {
      pageIndex: page ? Math.max(0, parseInt(page) - 1) : INITIAL_PAGINATION.pageIndex,
      pageSize: size ? parseInt(size) : INITIAL_PAGINATION.pageSize,
    };
  });

  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  
  const [sortBy, setSortBy] = useState<string | null>(
    () => searchParams.get("sort_by") || null
  );
  
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(
    () => (searchParams.get("order") as "asc" | "desc") || "asc"
  );
  
  const [statusFilters, setStatusFilters] = useState<string[]>(() => {
    const filters = searchParams.get("status");
    return filters ? filters.split(",") : INITIAL_STATUS_FILTERS;
  });

  const debouncedSearch = useDebounce(search, 500);

  // Sync URL with state (only non-default values)
  useEffect(() => {
    // Skip first render to avoid overwriting URL on mount
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const params = new URLSearchParams();

    // Only add page if not first page
    if (pagination.pageIndex !== INITIAL_PAGINATION.pageIndex) {
      params.set("page", (pagination.pageIndex + 1).toString());
    }

    // Only add size if not default
    if (pagination.pageSize !== INITIAL_PAGINATION.pageSize) {
      params.set("size", pagination.pageSize.toString());
    }

    // Only add search if not empty
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }

    // Only add sort if set
    if (sortBy) {
      params.set("sort_by", sortBy);
      params.set("order", sortOrder);
    }

    // Only add status filters if different from default
    if (!areArraysEqual(statusFilters, INITIAL_STATUS_FILTERS)) {
      params.set("status", statusFilters.join(","));
    }

    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    
    // Use replace to avoid polluting browser history
    router.replace(newUrl, { scroll: false });
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    debouncedSearch,
    sortBy,
    sortOrder,
    statusFilters,
    router,
  ]);

  // Build query params
  const queryParams: InventoryListParams = {
    page: pagination.pageIndex + 1,
    size: pagination.pageSize,
    search: debouncedSearch || undefined,
    sort_by: sortBy || undefined,
    order: sortBy ? sortOrder : undefined,
    stock_status: statusFilters.length > 0 ? statusFilters : undefined,
  };

  // React Query
  const query = useQuery({
    queryKey: ["inventory", queryParams],
    queryFn: () => getInventoryList(queryParams),
    staleTime: 2 * 60_000, // 2 minutes
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const errorStatus = getErrorStatus(query.error);

  // Reset to first page when filters change (but not pagination itself)
  useEffect(() => {
    setPagination((prev) => 
      prev.pageIndex !== 0 ? { ...prev, pageIndex: 0 } : prev
    );
  }, [debouncedSearch, statusFilters, sortBy, sortOrder]);

  // Handlers
  const onSortChange = (newSortBy: string | null, newSortOrder: "asc" | "desc") => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
  };

  return {
    // Data from query
    data: query.data?.items ?? [],
    totalPages: query.data?.pages ?? 0,
    totalItems: query.data?.total ?? 0,
    
    // Query state
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    errorStatus,
    
    // Controls
    pagination,
    onPaginationChange: setPagination,
    search,
    onSearchChange: setSearch,
    sortBy,
    sortOrder,
    onSortChange,
    statusFilters,
    onStatusFiltersChange: setStatusFilters,
  };
}
