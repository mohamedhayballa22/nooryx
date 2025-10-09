"use client"

import { ColumnDef, FilterFn } from "@tanstack/react-table"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

import { DataTableRowActions } from "./data-table-row-actions"

export type Product = {
  sku: string
  product_name: string
  location: string
  available: number
  last_transaction: string
  status: "In Stock" | "Low stock" | "Out of Stock"
}

// Custom filter function for multi-column searching (SKU + Product Name)
const multiColumnFilterFn: FilterFn<Product> = (row, filterValue) => {
  const searchTerm = (filterValue as string)?.toLowerCase()
  const rowContent =
    `${row.original.product_name} ${row.original.sku}`.toLowerCase()
  return rowContent.includes(searchTerm)
}

export const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "sku",
    header: "SKU",
  },
  {
    accessorKey: "product_name",
    filterFn: multiColumnFilterFn,
    header: "Product Name",
  },
  {
    accessorKey: "location",
    header: "Location",
  },
  {
    accessorKey: "available",
    header: "Available",
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge
          className={cn(
            "px-2 text-xs font-medium",
            status === "In Stock" &&
              "border-transparent bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/50 dark:text-green-300",
            status === "Low Stock" &&
              "border-transparent bg-orange-100 text-yellow-800 hover:bg-yellow-100/80 dark:bg-yellow-900/50 dark:text-yellow-300",
            status === "Out of Stock" &&
              "border-transparent bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/50 dark:text-red-300"
          )}
        >
          {status}
        </Badge>
      )
    },
  },
  {
    accessorKey: "last_transaction",
    header: "Last Transaction",
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <div className="flex justify-end">
        <DataTableRowActions row={row} />
      </div>
    ),
  },
]
