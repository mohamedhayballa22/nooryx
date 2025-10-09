"use client";

import React, { useState } from "react";
import { PaginationControls } from "@/components/app-pagination";
import { AuditTrail } from "@/components/audit-trail";
import { useAuditTrail } from "@/hooks/use-transactions";
import { DataToolbar } from "@/components/data-toolbar";
import { useDebounce } from "@/hooks/use-debounce";

const INITIAL_ACTION_FILTERS = [
  "added",
  "shipped",
  "reserved",
  "transferred",
  "adjusted",
  "unreserved",
];

export default function AuditTrailPage() {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [actionFilters, setActionFilters] = useState<string[]>(INITIAL_ACTION_FILTERS);

  const debouncedSearch = useDebounce(search, 500);

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
  React.useEffect(() => {
    if (pageIndex !== 0) {
      setPageIndex(0);
    }
  }, [debouncedSearch, actionFilters, sortBy, sortOrder]);

  const handleSortChange = (newSortBy: string | null, newSortOrder: "asc" | "desc") => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
  };

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
