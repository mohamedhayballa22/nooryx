"use client"

import { useId } from "react"
import { Table } from "@tanstack/react-table"
import {
  CircleXIcon,
  Columns3Icon,
  FilterIcon,
  ListFilterIcon,
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

interface FilterOption {
  label: string
  value: string
}

interface SortOption {
  label: string
  value: string
}

interface DataToolbarProps<TData> {
  table: Table<TData>
  search?: string
  onSearchChange?: (search: string) => void
  searchPlaceholder?: string
  filterLabel?: string
  filterOptions?: FilterOption[]
  activeFilters?: string[]
  onFiltersChange?: (filters: string[]) => void
  sortBy?: string | null
  sortOrder?: "asc" | "desc"
  sortOptions?: SortOption[]
  onSortChange?: (sortBy: string | null, sortOrder: "asc" | "desc") => void
  showViewToggle?: boolean
  actions?: React.ReactNode
}

export function DataToolbar<TData>({
  table,
  search,
  onSearchChange,
  searchPlaceholder = "Search...",
  filterLabel,
  filterOptions,
  activeFilters = [],
  onFiltersChange,
  sortBy,
  sortOrder = "asc",
  sortOptions,
  onSortChange,
  showViewToggle = false,
  actions,
}: DataToolbarProps<TData>) {
  const id = useId()

  const handleFilterChange = (checked: boolean, value: string) => {
    if (!onFiltersChange) return
    if (!checked && activeFilters.length === 1) return
    const newFilters = checked
      ? [...activeFilters, value]
      : activeFilters.filter((f) => f !== value)
    onFiltersChange(newFilters)
  }

  const handleSortByChange = (value: string) => {
    if (!onSortChange) return
    onSortChange(value, sortOrder)
  }

  return (
    <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-3 w-full sm:w-auto">
        {/* Search */}
        {onSearchChange && (
          <div className="relative w-full sm:w-auto">
            <Input
              id={`${id}-input`}
              className="peer w-full ps-9 sm:w-auto sm:min-w-60"
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              type="text"
              aria-label="Search"
            />
            <div className="text-muted-foreground/80 pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 peer-disabled:opacity-50">
              <ListFilterIcon size={16} aria-hidden="true" />
            </div>
            {search && (
              <button
                className="text-muted-foreground/80 hover:text-foreground absolute inset-y-0 end-0 flex h-full w-9 items-center justify-center rounded-e-md outline-none transition-colors focus-visible:ring-2 cursor-pointer"
                aria-label="Clear search"
                onClick={() => onSearchChange("")}
              >
                <CircleXIcon size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Filters */}
        {filterOptions && onFiltersChange && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="cursor-pointer">
                <FilterIcon className="-ms-1 opacity-60" size={16} />
                {filterLabel ?? "Filters"}
                {activeFilters.length > 0 && (
                  <span className="bg-background text-muted-foreground/70 -me-1 ml-2 inline-flex h-5 items-center rounded border px-1 text-[0.625rem] font-medium">
                    {activeFilters.length}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto min-w-40 p-3" align="start">
              <div className="space-y-3">
                <div className="text-muted-foreground text-xs font-medium">
                  {filterLabel ?? "Filters"}
                </div>
                <div className="space-y-3">
                  {filterOptions.map((opt) => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`${id}-${opt.value}`}
                        checked={activeFilters.includes(opt.value)}
                        disabled={activeFilters.length === 1 && activeFilters.includes(opt.value)}
                        onCheckedChange={(checked) =>
                          handleFilterChange(!!checked, opt.value)
                        }
                      />
                      <Label
                        htmlFor={`${id}-${opt.value}`}
                        className="flex grow justify-between gap-2 font-normal"
                      >
                        {opt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Sorting */}
        {sortOptions && onSortChange && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="cursor-pointer">
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
              <DropdownMenuRadioGroup
                value={sortBy || undefined} 
                onValueChange={handleSortByChange}
              >
                {sortOptions.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
              {sortBy && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel>Order</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={sortOrder}
                    onValueChange={(value) =>
                      onSortChange(sortBy, value as "asc" | "desc")
                    }
                  >
                    <DropdownMenuRadioItem value="asc">Ascending</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="desc">Descending</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Column visibility */}
        {showViewToggle && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="cursor-pointer">
                <Columns3Icon className="-ms-1 opacity-60" size={16} />
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide() && column.id !== "actions")
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) =>
                      column.toggleVisibility(!!value)
                    }
                  >
                    {column.id
                      .split("_")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ")}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Extra actions */}
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  )
}
