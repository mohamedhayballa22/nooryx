"use client"

import { useSearchParams } from "next/navigation"
import { DataTable } from "@/components/data-table/data-table"
import { columns } from "./columns"
import { useInventoryList } from "@/hooks/use-inventory"
import { EmptyInventory } from "@/components/empty-inventory"
import { SkuMasterView } from "@/components/SkuMasterView"

function InventoryContent() {
  const searchParams = useSearchParams()
  const skuCode = searchParams.get("sku")

  // If SKU is in query params, show detail view (don't use the hook)
  if (skuCode) {
    return <SkuMasterView skuCode={skuCode} />
  }

  // Only use the hook for list view
  return <InventoryListView />
}

function InventoryListView() {
  const {
    data,
    isLoading,
    isFetching,
    error,
    errorStatus,
    pagination,
    onPaginationChange,
    totalPages,
    totalItems,
    search,
    onSearchChange,
    sortBy,
    sortOrder,
    onSortChange,
    statusFilters,
    onStatusFiltersChange,
  } = useInventoryList()

  if (errorStatus === 404) {
    return <EmptyInventory />
  }

  return (
    <div className="container mx-auto">
      {error && (
        <div className="mb-4 rounded-md bg-destructive/15 p-4 text-destructive">
          Error: {error instanceof Error ? error.message : "Failed to load inventory"}
          {errorStatus && ` (Status: ${errorStatus})`}
        </div>
      )}
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        isFetching={isFetching}
        pagination={pagination}
        onPaginationChange={onPaginationChange}
        totalPages={totalPages}
        totalItems={totalItems}
        search={search}
        onSearchChange={onSearchChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={onSortChange}
        statusFilters={statusFilters}
        onStatusFiltersChange={onStatusFiltersChange}
      />
    </div>
  )
}

export default function StockPage() {
  return (
    <InventoryContent />
  )
}

