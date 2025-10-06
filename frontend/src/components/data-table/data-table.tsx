"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  VisibilityState,
  PaginationState,
  OnChangeFn,
} from "@tanstack/react-table"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { DataToolbar } from "@/components/data-toolbar"
import { PaginationControls } from "@/components/app-pagination"
import { Button } from "@/components/ui/button"
import { PlusIcon } from "lucide-react"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  loading?: boolean
  pagination: PaginationState
  onPaginationChange: (pagination: PaginationState) => void
  totalPages: number
  totalItems: number
  search: string
  onSearchChange: (search: string) => void
  sortBy: string | null
  sortOrder: "asc" | "desc"
  onSortChange: (sortBy: string | null, sortOrder: "asc" | "desc") => void
  statusFilters: string[]
  onStatusFiltersChange: (filters: string[]) => void
}

const STOCK_STATUSES = [
  { value: "In Stock", label: "In Stock" },
  { value: "Low Stock", label: "Low Stock" },
  { value: "Out of Stock", label: "Out of Stock" },
]

const SORT_OPTIONS = [
  { value: "product_name", label: "Product Name" },
  { value: "sku", label: "SKU" },
  { value: "available", label: "Available" },
  { value: "status", label: "Status" },
  { value: "location", label: "Location" },
]

export function DataTable<TData, TValue>({
  columns,
  data,
  loading = false,
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
}: DataTableProps<TData, TValue>) {
  const router = useRouter()
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})

  const handlePaginationChange: OnChangeFn<PaginationState> = (updaterOrValue) => {
    const newPagination =
      typeof updaterOrValue === "function"
        ? updaterOrValue(pagination)
        : updaterOrValue
    onPaginationChange(newPagination)
  }

  const table = useReactTable({
    data,
    columns,
    pageCount: totalPages,
    state: {
      pagination,
      columnVisibility,
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })

  return (
    <div className="space-y-4">
      <DataToolbar
        table={table}
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder="Search by SKU or location..."
        filterLabel="Status"
        filterOptions={STOCK_STATUSES}
        activeFilters={statusFilters}
        onFiltersChange={onStatusFiltersChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        sortOptions={SORT_OPTIONS}
        onSortChange={onSortChange}
        showViewToggle
        actions={
          <Button variant="outline">
            <PlusIcon className="-ms-1 opacity-60" size={16} />
            Add
          </Button>
        }
      />

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading || data.length === 0 ? (
              Array.from({ length: pagination.pageSize }).map((_, index) => (
                <TableRow key={index}>
                  {columns.map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => {
                    const sku = (row.original as any).sku
                    if (sku) {
                      router.push(`/core/inventory/${sku}`)
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        pageIndex={pagination.pageIndex}
        pageSize={pagination.pageSize}
        totalPages={totalPages}
        totalItems={totalItems}
        loading={loading}
        onPageChange={(newPage) =>
          onPaginationChange({ ...pagination, pageIndex: newPage })
        }
        onPageSizeChange={(newSize) =>
          onPaginationChange({ pageIndex: 0, pageSize: newSize })
        }
      />
    </div>
  )
}
