// app/audit-trail/page.tsx
"use client"

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { PaginationControls } from "@/components/app-pagination"
import { AuditTrail } from "@/components/audit-trail"
import { useTransactions } from "@/hooks/use-transactions"
import { DataToolbar } from "@/components/data-toolbar"

export default function AuditTrailPage() {
  const {
    data,
    totalItems,
    totalPages,
    pagination,
    loading,
    error,
    onPaginationChange,
    search,
    onSearchChange,
    sortBy,
    sortOrder,
    onSortChange,
    actionFilters,
    onActionFiltersChange,
  } = useTransactions()

  const SkeletonTimeline = (
    <div>
      <div className="space-y-6">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={`sk-${i}`} className="flex items-start gap-4">
            <div className="flex flex-col items-center">
              <div className="h-4 w-4 rounded-full bg-muted/60 animate-pulse" />
              {i < 5 && <div className="flex-1 w-[1px] bg-muted/30 mt-2" />}
            </div>
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-64 rounded" />
              <Skeleton className="h-3 w-48 rounded" />
              <Skeleton className="h-3 w-32 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <DataToolbar
        table={{ getAllColumns: () => [] } as any}
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search by SKU, action, SKU..."
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
        onFiltersChange={onActionFiltersChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        sortOptions={[
          { label: "Date", value: "date" },
          { label: "Actor", value: "actor" },
          { label: "Action", value: "action" },
          { label: "SKU", value: "sku" },
          { label: "Location", value: "location" },
          { label: "Quantity", value: "quantity" },
        ]}
        onSortChange={onSortChange}
      />

      {/* Content */}
      {error ? (
        <div className="p-4 rounded border border-red-200 bg-red-50 text-red-800">
          <strong>Error:</strong> {error}
        </div>
      ) : loading ? (
        SkeletonTimeline
      ) : (
        <AuditTrail items={data} />
      )}

      <div className="px-6">
        <PaginationControls
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          totalPages={totalPages}
          totalItems={totalItems}
          loading={loading}
          onPageChange={(idx) => onPaginationChange({ ...pagination, pageIndex: idx })}
          onPageSizeChange={(size) => onPaginationChange({ ...pagination, pageSize: size })}
        />
      </div>
    </div>
  )
}
