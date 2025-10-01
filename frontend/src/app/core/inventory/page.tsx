"use client"

import { DataTable } from "@/components/data-table/data-table"
import { columns } from "./columns"
import { useInventory } from "@/hooks/use-inventory"

export default function StockPage() {
  const {
    data,
    loading,
    error,
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
  } = useInventory()

  return (
    <div className="container mx-auto p-4">
      {error && (
        <div className="mb-4 rounded-md bg-destructive/15 p-4 text-destructive">
          Error: {error}
        </div>
      )}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
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
