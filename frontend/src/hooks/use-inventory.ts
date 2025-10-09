"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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

export function useInventoryList() {
  // State for controls
  const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [statusFilters, setStatusFilters] = useState<string[]>(INITIAL_STATUS_FILTERS);

  const debouncedSearch = useDebounce(search, 500);

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

  // Reset to first page when filters change
  useEffect(() => {
    if (pagination.pageIndex !== 0) {
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }
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
