"use client"

import { useState, useEffect } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { PaginationState } from "@tanstack/react-table"
import { Product } from "@/app/core/inventory/columns"

interface InventoryResponse {
  items: Product[]
  total: number
  page: number
  size: number
  pages: number
}

const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: 10 }
const INITIAL_STATUS_FILTERS = ["In Stock", "Low Stock", "Out of Stock"]

export function useInventory() {
  const [data, setData] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // State for controls
  const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [statusFilters, setStatusFilters] = useState<string[]>(INITIAL_STATUS_FILTERS)

  const debouncedSearch = useDebounce(search, 500)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    const fetchInventory = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams({
          page: String(pagination.pageIndex + 1),
          size: String(pagination.pageSize),
        })

        if (debouncedSearch) {
          params.append("search", debouncedSearch)
        }
        if (sortBy) {
          params.append("sort_by", sortBy)
          params.append("order", sortOrder)
        }
        statusFilters.forEach((status) => {
          params.append("stock_status", status)
        })

        const response = await fetch(
          `http://localhost:8000/inventory?${params.toString()}`,
          { signal }
        )

        if (!response.ok) {
          throw new Error("Failed to fetch inventory data")
        }

        const result: InventoryResponse = await response.json()

        setData(result.items)
        setTotalPages(result.pages)
        setTotalItems(result.total)
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("Fetch aborted")
        } else {
          setError(err instanceof Error ? err.message : "An unknown error occurred")
          setData([])
        }
      } finally {
        setLoading(false)
      }
    }

    fetchInventory()

    // Cleanup function to abort fetch on re-render or unmount
    return () => {
      controller.abort()
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    debouncedSearch,
    sortBy,
    sortOrder,
    statusFilters,
  ])

  // Effect to reset to the first page when filters/sorting/search change
  useEffect(() => {
    if (pagination.pageIndex !== 0) {
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    }
  }, [debouncedSearch, statusFilters, sortBy, sortOrder])

  // Handlers for state changes
  const onSortChange = (newSortBy: string | null, newSortOrder: "asc" | "desc") => {
    setSortBy(newSortBy)
    setSortOrder(newSortOrder)
  }

  return {
    data,
    loading,
    error,
    pagination,
    onPaginationChange: setPagination,
    totalPages,
    totalItems,
    search,
    onSearchChange: setSearch,
    sortBy,
    sortOrder,
    onSortChange,
    statusFilters,
    onStatusFiltersChange: setStatusFilters,
  }
}
