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

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

import { ReceiveForm } from "@/components/forms/receive-form"
import { AdjustForm } from "@/components/forms/adjust-form"
import { ReserveForm } from "@/components/forms/reserve-form"
import { ShipForm } from "@/components/forms/ship-form"
import { UnreserveForm } from "@/components/forms/unreserve-form"
import { TransferForm } from "@/components/forms/transfer-form"
import { NavArrowDownSolid } from "iconoir-react"

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  isLoading?: boolean
  isFetching?: boolean
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
  { value: "name", label: "SKU Name" },
  { value: "sku_code", label: "SKU Code" },
  { value: "available", label: "Available" },
  { value: "status", label: "Status" },
  { value: "location", label: "Location" },
]

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  isFetching = false,
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
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [activeForm, setActiveForm] = useState<string | null>(null)

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

  const showSkeleton = isLoading || (isFetching && data.length === 0)

  return (
    <>
      <div className="space-y-4">
        <DataToolbar
          table={table}
          search={search}
          onSearchChange={onSearchChange}
          searchPlaceholder="Search by SKU Code or location..."
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
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsFormOpen(true)}
              >
                <PlusIcon className="-ms-1 opacity-60" size={16} />
                Receive
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    Stock Actions
                    <NavArrowDownSolid /> 
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setActiveForm("ship")}>
                    Ship Stock
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveForm("reserve")}>
                    Reserve Stock
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveForm("unreserve")}>
                    Unreserve Stock
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveForm("transfer")}>
                    Transfer Stock
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActiveForm("adjust")}>
                    Adjust Stock
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
              {showSkeleton ? (
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
                      const skuCode = (row.original as any).sku_code
                      if (skuCode) {
                        router.push(`/core/inventory?sku=${encodeURIComponent(skuCode)}`)
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
          loading={isFetching}
          onPageChange={(newPage) =>
            onPaginationChange({ ...pagination, pageIndex: newPage })
          }
          onPageSizeChange={(newSize) =>
            onPaginationChange({ pageIndex: 0, pageSize: newSize })
          }
        />
      </div>

      {/* Forms */}
      <ReceiveForm
        open={isFormOpen || activeForm === "receive"}
        onOpenChange={(open) => !open && (setIsFormOpen(false), setActiveForm(null))}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
      />
      <ShipForm
        open={activeForm === "ship"}
        onOpenChange={(open) => !open && setActiveForm(null)}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
      />
      <ReserveForm
        open={activeForm === "reserve"}
        onOpenChange={(open) => !open && setActiveForm(null)}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
      />
      <UnreserveForm
        open={activeForm === "unreserve"}
        onOpenChange={(open) => !open && setActiveForm(null)}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
      />
      <TransferForm
        open={activeForm === "transfer"}
        onOpenChange={(open) => !open && setActiveForm(null)}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
      />
      <AdjustForm
        open={activeForm === "adjust"}
        onOpenChange={(open) => !open && setActiveForm(null)}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
      />
    </>
  )
}

DataTable.Skeleton = function DataTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Table skeleton only */}
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU Code</TableHead>
              <TableHead>SKU Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Available</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Transaction</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button variant="ghost" className="h-8 w-8 p-0" disabled>
                      <span className="sr-only">Open menu</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-32" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-10 w-10" />
        </div>
      </div>
    </div>
  )
}
