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
import { ScanBarcode, Settings, ChevronDown } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"

import { ReceiveForm } from "@/components/forms/receive-form"
import { AdjustForm } from "@/components/forms/adjust-form"
import { ReserveForm } from "@/components/forms/reserve-form"
import { ShipForm } from "@/components/forms/ship-form"
import { UnreserveForm } from "@/components/forms/unreserve-form"
import { TransferForm } from "@/components/forms/transfer-form"
import { UpdateSkuForm } from "@/components/forms/updatesku/update-sku-form"
import { NavArrowDownSolid } from "iconoir-react"
import { BarcodeManager } from "../barcode/barcode-manager"

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

const DEFAULT_SORT_BY = "sku_code"
const DEFAULT_SORT_ORDER = "asc"

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
  const [scannerOpen, setScannerOpen] = useState(false)

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
    // 1. Pass the function to open the specific form via meta
    meta: {
      openThresholdForm: () => setActiveForm("update-sku"),
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
          sortBy={sortBy || DEFAULT_SORT_BY}
          sortOrder={sortBy ? sortOrder : DEFAULT_SORT_ORDER}
          sortOptions={SORT_OPTIONS}
          onSortChange={onSortChange}
          showViewToggle
          actions={
            <div className="flex items-center gap-2">
              {/* --- Desktop Layout (Split Button) --- */}
              <div className="hidden md:flex items-center gap-2">
                <div className="flex items-stretch border rounded-md overflow-hidden">
                  <Button
                    variant="ghost"
                    className="rounded-none border-0 hover:bg-accent"
                    onClick={() => setScannerOpen(true)}
                  >
                    <ScanBarcode className="h-4 w-4 mr-2" />
                    Scan Barcode
                  </Button>
                  <div className="w-px bg-border" />
                  <Button 
                    variant="ghost"
                    className="rounded-none border-0 hover:bg-accent"
                    onClick={() => setIsFormOpen(true)}
                  >
                    Receive Stock
                  </Button>
                  <div className="w-px bg-border" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost"
                        className="rounded-none border-0 h-full px-3 hover:bg-accent"
                      >
                        <NavArrowDownSolid className="h-4 w-4 mt-0.5" />
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
                
                <Button 
                  variant="outline" 
                  size="icon"
                  aria-label="Update SKU settings"
                  onClick={() => setActiveForm("update-sku")}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>

              {/* --- Mobile Layout (Stacked "Actions" Dropdown) --- */}
              <div className="flex md:hidden items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => setScannerOpen(true)}>
                  <ScanBarcode className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      Actions <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Inventory Actions</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setIsFormOpen(true)}>
                      Receive Stock
                    </DropdownMenuItem>
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setActiveForm("update-sku")}>
                      <Settings className="mr-2 h-4 w-4" /> SKU Settings
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          }
        />

        <div className="rounded-md border overflow-hidden">
          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id} className="whitespace-nowrap">
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
                      tabIndex={0}
                      role="button"
                      onClick={() => {
                        const skuCode = (row.original as any).sku_code
                        if (skuCode) {
                          router.push(`/core/inventory?sku=${encodeURIComponent(skuCode)}`)
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          const skuCode = (row.original as any).sku_code
                          if (skuCode) {
                            router.push(`/core/inventory?sku=${encodeURIComponent(skuCode)}`)
                          }
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="whitespace-nowrap">
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
      <UpdateSkuForm
        open={activeForm === "update-sku"}
        onOpenChange={(open) => !open && setActiveForm(null)}
      />
      <ReceiveForm
        open={isFormOpen || activeForm === "receive"}
        onOpenChange={(open) => !open && (setIsFormOpen(false), setActiveForm(null))}
        invalidateQueries={["inventory", "transactions", "trend", "valuation", "search", "skus"]}
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

      <BarcodeManager
        open={scannerOpen}
        onOpenChange={setScannerOpen}
      />
    </>
  )
}

DataTable.Skeleton = function DataTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-hidden">
        <div className="relative w-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="whitespace-nowrap">SKU Code</TableHead>
                <TableHead className="whitespace-nowrap">SKU Name</TableHead>
                <TableHead className="whitespace-nowrap">Location</TableHead>
                <TableHead className="whitespace-nowrap">Available</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap">Last Transaction</TableHead>
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
      </div>
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
