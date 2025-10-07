"use client"

import { ColumnDef, FilterFn } from "@tanstack/react-table"
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

import { DataTableRowActions } from "./data-table-row-actions"

// Define the shape of your product data
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

// A reusable header component for sortable columns
const SortableHeader = ({ column, children, className }: { column: any, children: React.ReactNode, className?: string }) => (
  <div
    className={cn("flex cursor-pointer select-none items-center gap-2", className)}
    onClick={column.getToggleSortingHandler()}
  >
    {children}
    {{
      asc: <ChevronUpIcon size={16} className="opacity-60" />,
      desc: <ChevronDownIcon size={16} className="opacity-60" />,
    }[column.getIsSorted() as string] ?? null}
  </div>
);


export const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "sku",
    header: ({ column }) => (
      <SortableHeader column={column}>SKU</SortableHeader>
    ),
  },
  {
    accessorKey: "product_name",
    // This column will be used for global filtering
    filterFn: multiColumnFilterFn,
    header: ({ column }) => (
      <SortableHeader column={column}>Product Name</SortableHeader>
    ),
  },
  {
    accessorKey: "location",
    header: ({ column }) => (
      <SortableHeader column={column}>Location</SortableHeader>
    ),
  },
  {
    accessorKey: "available",
    header: ({ column }) => (
        <SortableHeader column={column}>
          Available
        </SortableHeader>
    ),
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <SortableHeader column={column}>Status</SortableHeader>
    ),
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
    header: ({ column }) => (
      <SortableHeader column={column}>Last Transaction</SortableHeader>
    ),
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
