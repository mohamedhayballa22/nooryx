"use client"

import React from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { PaginationControls } from "@/components/app-pagination"
import { AuditTrail } from "@/components/audit-trail"
import { useTransactions } from "@/hooks/use-transactions"

export default function AuditTrailPage() {
  const {
    items,
    totalItems,
    totalPages,
    pageIndex,
    pageSize,
    loading,
    error,
    setPageIndex,
    setPageSize,
    refetch,
  } = useTransactions(0, 10)

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
    <div className="space-y-6 p-10">
      {error ? (
        <div className="p-4 rounded border border-red-200 bg-red-50 text-red-800">
          <strong>Error:</strong> {error.message ?? "Unknown error"}
          <div className="mt-2">
            <button
              className="px-3 py-1 rounded border"
              onClick={() => refetch()}
            >
              Retry
            </button>
          </div>
        </div>
      ) : loading || items.length === 0 ? (
        SkeletonTimeline
      ) : (
        <AuditTrail items={items} />
      )}

      <div className="px-6">
        <PaginationControls
          pageIndex={pageIndex}
          pageSize={pageSize}
          totalPages={totalPages}
          totalItems={totalItems}
          loading={loading}
          onPageChange={(idx) => setPageIndex(idx)}
          onPageSizeChange={(size) => setPageSize(size)}
        />
      </div>
    </div>
  )
}
