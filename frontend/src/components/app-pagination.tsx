"use client"

import {
  ChevronFirstIcon,
  ChevronLastIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from "@/components/ui/pagination"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface PaginationControlsProps {
  pageIndex: number
  pageSize: number
  totalPages: number
  totalItems: number
  loading?: boolean
  onPageChange: (pageIndex: number) => void
  onPageSizeChange: (pageSize: number) => void
}

export function PaginationControls({
  pageIndex,
  pageSize,
  totalPages,
  totalItems,
  loading = false,
  onPageChange,
  onPageSizeChange,
}: PaginationControlsProps) {
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
      <div className="flex items-center gap-2 order-3 sm:order-1">
        <p className="text-sm text-muted-foreground">Rows per page</p>
        <Select
          value={`${pageSize}`}
          onValueChange={(value) => {
            onPageSizeChange(Number(value))
          }}
        >
          <SelectTrigger className="h-8 w-[74px]">
            <SelectValue placeholder={pageSize} />
          </SelectTrigger>
          <SelectContent>
            {[10, 25, 50, 100].map((size) => (
              <SelectItem key={size} value={`${size}`}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-muted-foreground text-sm text-center order-1 sm:order-2 sm:text-left">
        Page {pageIndex + 1} of {totalPages || 1} ({totalItems} total items)
      </div>

      <Pagination className="mx-0 w-auto order-2 sm:order-3">
        <PaginationContent>
          <PaginationItem>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(0)}
              disabled={pageIndex === 0 || loading}
              aria-label="Go to first page"
            >
              <ChevronFirstIcon className="h-4 w-4" />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(Math.max(0, pageIndex - 1))}
              disabled={pageIndex === 0 || loading}
              aria-label="Go to previous page"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(Math.min(totalPages - 1, pageIndex + 1))}
              disabled={pageIndex >= totalPages - 1 || loading}
              aria-label="Go to next page"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPageChange(totalPages - 1)}
              disabled={pageIndex >= totalPages - 1 || loading}
              aria-label="Go to last page"
            >
              <ChevronLastIcon className="h-4 w-4" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
