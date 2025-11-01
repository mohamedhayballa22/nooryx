"use client"

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  PaginationState,
  OnChangeFn,
} from "@tanstack/react-table"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { PaginationControls } from "@/components/app-pagination"

interface ValuationItem {
  sku_code: string
  name: string
  total_qty: number
  avg_cost: string
  total_value: string
  currency: string
}

interface ValuationDataTableProps {
  data: ValuationItem[]
  pagination: PaginationState
  onPaginationChange: (pagination: PaginationState) => void
  totalPages: number
  totalItems: number
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const quantityFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const columns: ColumnDef<ValuationItem>[] = [
  {
    accessorKey: "sku_code",
    header: "SKU Code",
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("sku_code")}</div>
    ),
  },
  {
    accessorKey: "name",
    header: "SKU Name",
    cell: ({ row }) => (
      <div className="max-w-[300px] truncate">{row.getValue("name")}</div>
    ),
  },
  {
    accessorKey: "total_qty",
    header: () => <div className="text-right">Total Quantity</div>,
    cell: ({ row }) => (
      <div className="text-right font-medium">
        {quantityFormatter.format(row.getValue("total_qty"))}
      </div>
    ),
  },
  {
    accessorKey: "avg_cost",
    header: () => <div className="text-right">Average Cost</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("avg_cost"))
      return (
        <div className="text-right text-muted-foreground">
          {currencyFormatter.format(amount)}
        </div>
      )
    },
  },
  {
    accessorKey: "total_value",
    header: () => <div className="text-right">Total Value</div>,
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue("total_value"))
      return (
        <div className="text-right font-semibold">
          {currencyFormatter.format(amount)}
        </div>
      )
    },
  },
]

export function ValuationDataTable({
  data,
  pagination,
  onPaginationChange,
  totalPages,
  totalItems,
}: ValuationDataTableProps) {
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
    },
    onPaginationChange: handlePaginationChange,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  })

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border bg-card">
        <div className="absolute inset-0 bg-gradient-to-br from-muted/20 via-transparent to-transparent pointer-events-none" />
        <div className="relative">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="px-6">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="px-6">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center px-6">
                    No valuation data found.
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
        loading={false}
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

ValuationDataTable.Skeleton = function ValuationDataTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU Code</TableHead>
              <TableHead>SKU Name</TableHead>
              <TableHead className="text-right">Total Quantity</TableHead>
              <TableHead className="text-right">Average Cost</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 10 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-20 ml-auto" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-center gap-2">
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
        <Skeleton className="h-10 w-10" />
      </div>
    </div>
  )
}
