"use client"

import { useId } from "react"
import { Table } from "@tanstack/react-table"
import {
  CircleXIcon,
  Columns3Icon,
  FilterIcon,
  ListFilterIcon,
  PlusIcon,
  ArrowUpDownIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DataTableToolbarProps<TData> {
  table: Table<TData>
  search: string
  onSearchChange: (search: string) => void
  sortBy: string | null
  sortOrder: "asc" | "desc"
  onSortChange: (sortBy: string | null, sortOrder: "asc" | "desc") => void
  statusFilters: string[]
  onStatusFiltersChange: (filters: string[]) => void
}

const STOCK_STATUSES = ["In Stock", "Low Stock", "Out of Stock"]

const SORT_OPTIONS = [
  { value: "product_name", label: "Product Name" },
  { value: "sku", label: "SKU" },
  { value: "available", label: "Available" },
  { value: "status", label: "Status" },
  { value: "location", label: "Location" },
]

export function DataTableToolbar<TData>({
  table,
  search,
  onSearchChange,
  sortBy,
  sortOrder,
  onSortChange,
  statusFilters,
  onStatusFiltersChange,
}: DataTableToolbarProps<TData>) {
  const id = useId()

  const handleStatusChange = (checked: boolean, value: string) => {
    const newFilters = checked
      ? [...statusFilters, value]
      : statusFilters.filter((status) => status !== value)
    onStatusFiltersChange(newFilters)
  }

  const handleSortByChange = (value: string) => {
    if (value === "none") {
      onSortChange(null, "asc")
    } else {
      onSortChange(value, sortOrder)
    }
  }

  const handleSortOrderToggle = () => {
    if (sortBy) {
      onSortChange(sortBy, sortOrder === "asc" ? "desc" : "asc")
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {/* Search by SKU or location */}
        <div className="relative">
          <Input
            id={`${id}-input`}
            className="peer min-w-60 ps-9"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search by SKU or location..."
            type="text"
            aria-label="Search by SKU or location"
          />
          <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
            <ListFilterIcon size={16} aria-hidden="true" />
          </div>
          {search && (
            <button
              className="text-muted-foreground/80 hover:text-foreground absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md outline-none transition-colors focus-visible:ring-2"
              aria-label="Clear search"
              onClick={() => onSearchChange("")}
            >
              <CircleXIcon size={16} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Filter by status */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <FilterIcon className="-ms-1 opacity-60" size={16} />
              Status
              {statusFilters.length > 0 && (
                <span className="bg-background text-muted-foreground/70 -me-1 ml-2 inline-flex h-5 items-center rounded border px-1 text-[0.625rem] font-medium">
                  {statusFilters.length}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto min-w-40 p-3" align="start">
            <div className="space-y-3">
              <div className="text-muted-foreground text-xs font-medium">
                Filter by status
              </div>
              <div className="space-y-3">
                {STOCK_STATUSES.map((status) => (
                  <div key={status} className="flex items-center gap-2">
                    <Checkbox
                      id={`${id}-${status}`}
                      checked={statusFilters.includes(status)}
                      onCheckedChange={(checked) =>
                        handleStatusChange(!!checked, status)
                      }
                    />
                    <Label
                      htmlFor={`${id}-${status}`}
                      className="flex grow justify-between gap-2 font-normal"
                    >
                      {status}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Sort by */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <ArrowUpDownIcon className="-ms-1 opacity-60" size={16} />
              Sort by
              {sortBy && (
                <span className="bg-background text-muted-foreground/70 -me-1 ml-2 inline-flex h-5 items-center rounded border px-1 text-[0.625rem] font-medium">
                  {sortOrder === "asc" ? "↑" : "↓"}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={sortBy || "none"} onValueChange={handleSortByChange}>
              <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
              {SORT_OPTIONS.map((option) => (
                <DropdownMenuRadioItem key={option.value} value={option.value}>
                  {option.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {sortBy && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Order</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={sortOrder} onValueChange={(value) => onSortChange(sortBy, value as "asc" | "desc")}>
                  <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="desc">Descending</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Toggle columns visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <Columns3Icon className="-ms-1 opacity-60" size={16} />
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            {table
              .getAllColumns()
              .filter((column) => column.getCanHide() && column.id !== 'actions')
              .map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className="capitalize"
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id
                    .split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-3">
        {/* Add product button */}
        <Button variant="outline">
          <PlusIcon className="-ms-1 opacity-60" size={16} />
          Add Product
        </Button>
      </div>
    </div>
  )
}
