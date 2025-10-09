"use client";

import React, { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PaginationControls } from "@/components/app-pagination";
import { AuditTrail } from "@/components/audit-trail";
import { useAuditTrail } from "@/hooks/use-transactions"
import { DataToolbar } from "@/components/data-toolbar";
import { useDebounce } from "@/hooks/use-debounce";
import { EmptyAuditTrail } from "@/components/empty-audit-trail";

const INITIAL_ACTION_FILTERS = [
  "added",
  "shipped",
  "reserved",
  "transferred",
  "adjusted",
  "unreserved",
];

function parseUrlParams(searchParams: URLSearchParams) {
  const page = parseInt(searchParams.get("page") || "1", 10) - 1; // Convert to 0-indexed
  const size = parseInt(searchParams.get("size") || "10", 10);
  const search = searchParams.get("search") || "";
  const sortBy = searchParams.get("sort_by") || null;
  const sortOrder = (searchParams.get("order") || "asc") as "asc" | "desc";
  const actions = searchParams.getAll("action");
  
  return {
    page: Math.max(0, page),
    size,
    search,
    sortBy,
    sortOrder,
    actions: actions.length > 0 ? actions : INITIAL_ACTION_FILTERS,
  };
}

export default function AuditTrailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize state from URL
  const urlParams = parseUrlParams(searchParams);
  
  const [pageIndex, setPageIndex] = React.useState(urlParams.page);
  const [pageSize, setPageSize] = React.useState(urlParams.size);
  const [search, setSearch] = React.useState(urlParams.search);
  const [sortBy, setSortBy] = React.useState<string | null>(urlParams.sortBy);
  const [sortOrder, setSortOrder] = React.useState<"asc" | "desc">(urlParams.sortOrder);
  const [actionFilters, setActionFilters] = React.useState<string[]>(urlParams.actions);

  const debouncedSearch = useDebounce(search, 500);

  // Sync URL with state
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (pageIndex !== 0) {
      params.set("page", String(pageIndex + 1));
    }
    
    if (pageSize !== 10) {
      params.set("size", String(pageSize));
    }
    
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }
    
    if (sortBy) {
      params.set("sort_by", sortBy);
      params.set("order", sortOrder);
    }
    
    const isDefaultFilters = 
      actionFilters.length === INITIAL_ACTION_FILTERS.length &&
      actionFilters.every((action) => INITIAL_ACTION_FILTERS.includes(action));
    
    if (!isDefaultFilters) {
      actionFilters.forEach((action) => {
        params.append("action", action);
      });
    }
    
    // Update URL - if no params, just use the base path
    const queryString = params.toString();
    router.replace(queryString ? `?${queryString}` : window.location.pathname, { scroll: false });
  }, [pageIndex, pageSize, debouncedSearch, sortBy, sortOrder, actionFilters, router]);

  const {
    items,
    totalItems,
    totalPages,
    isLoading,
    error,
    errorStatus,
  } = useAuditTrail({
    page: pageIndex + 1,
    size: pageSize,
    search: debouncedSearch || undefined,
    sort_by: sortBy || undefined,
    order: sortOrder,
    actions: actionFilters,
  });

  // Reset to page 0 when filters/search/sort change
  useEffect(() => {
    if (pageIndex !== 0) {
      setPageIndex(0);
    }
  }, [debouncedSearch, actionFilters, sortBy, sortOrder]);

  const handleSortChange = (newSortBy: string | null, newSortOrder: "asc" | "desc") => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
  };

  if (errorStatus === 404) {
    return <EmptyAuditTrail/>;
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <DataToolbar
        table={{ getAllColumns: () => [] } as any}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by SKU, actor, action..."
        filterLabel="Actions"
        filterOptions={[
          { label: "Added", value: "added" },
          { label: "Shipped", value: "shipped" },
          { label: "Reserved", value: "reserved" },
          { label: "Transferred", value: "transferred" },
          { label: "Adjusted", value: "adjusted" },
          { label: "Unreserved", value: "unreserved" },
        ]}
        activeFilters={actionFilters}
        onFiltersChange={setActionFilters}
        sortBy={sortBy}
        sortOrder={sortOrder}
        sortOptions={[
          { label: "Date", value: "created_at" },
          { label: "Actor", value: "actor" },
          { label: "Action", value: "action" },
          { label: "SKU", value: "sku" },
          { label: "Location", value: "location" },
          { label: "Quantity", value: "quantity" },
        ]}
        onSortChange={handleSortChange}
      />

      {/* Content */}
      {error ? (
        <div className="p-4 rounded border border-red-200 bg-red-50 text-red-800">
          <strong>Error:</strong> {error instanceof Error ? error.message : "An unknown error occurred"}
          {errorStatus && <span className="ml-2">(Status: {errorStatus})</span>}
        </div>
      ) : isLoading ? (
        <AuditTrail.Skeleton />
      ) : (
        <AuditTrail items={items} />
      )}

      <div className="px-6">
        <PaginationControls
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalPages={totalPages}
          totalItems={totalItems}
          loading={isLoading}
          onPageChange={setPageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPageIndex(0);
          }}
        />
      </div>
    </div>
  );
}
