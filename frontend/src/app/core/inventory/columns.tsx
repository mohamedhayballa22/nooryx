"use client"

import { ColumnDef, FilterFn, RowData } from "@tanstack/react-table"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { HelpCircle } from "lucide-react"
import Link from "next/link"

import { DataTableRowActions } from "./data-table-row-actions"

// Extend TanStack Table to include our custom function
declare module "@tanstack/react-table" {
  interface TableMeta<TData extends RowData> {
    openThresholdForm: () => void
  }
}

export type Product = {
  sku_code: string
  name: string
  location: string
  available: number
  last_transaction: string
  status: "In Stock" | "Low Stock" | "Out of Stock"
}

// Custom filter function for multi-column searching (SKU Code + Name)
const multiColumnFilterFn: FilterFn<Product> = (row, filterValue) => {
  const searchTerm = (filterValue as string)?.toLowerCase()
  const rowContent =
    `${row.original.name} ${row.original.sku_code}`.toLowerCase()
  return rowContent.includes(searchTerm)
}

export const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "sku_code",
    header: "SKU Code",
  },
  {
    accessorKey: "name",
    filterFn: multiColumnFilterFn,
    header: "SKU Name",
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
    // Destructure 'table' to access the meta function
    header: ({ table }) => (
      <div className="flex items-center gap-1.5">
        <span>Status</span>
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                aria-label="Stock status information"
              >
                <HelpCircle className="h-3.5 w-3.5 mt-0.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              align="center"
              className="space-y-3 border bg-popover p-4 max-w-[320px] w-full"
              sideOffset={8}
            >
              <div className="space-y-1.5">
                <p className="text-sm font-medium leading-snug text-foreground">
                  Stock status thresholds
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Configure your inventory thresholds
                </p>
              </div>
              
              {/* Two-Button Layout */}
              <div className="flex gap-2 pt-1">
                <Link href="/core/settings/operations" className="block">
                  <Button
                    size="sm"
                    className="h-8 w-full flex-1 text-xs"
                    variant="outline"
                  >
                    Set Defaults
                  </Button>
                </Link>
                <Button
                  size="sm"
                  className="h-8 flex-1 text-xs"
                  variant="default"
                  onClick={() => table.options.meta?.openThresholdForm()}
                >
                  Set thresholds for an SKU
                </Button>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      return (
        <Badge
          className={cn(
            "px-2 text-xs font-medium",
            status === "In Stock" &&
              "border-transparent bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
            status === "Low Stock" &&
              "border-transparent bg-orange-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
            status === "Out of Stock" &&
              "border-transparent bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
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
