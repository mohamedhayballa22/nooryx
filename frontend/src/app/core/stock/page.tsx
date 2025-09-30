"use client";

import { useEffect, useState, useCallback } from "react"
import { useDebounce } from "@/hooks/use-debounce"

import { DataTable } from "@/components/data-table/data-table"

import { columns, Product } from "./columns"

interface InventoryResponse {
  items: Product[]
  total: number
  page: number
  size: number
  pages: number
}

export default function StockPage() {
  const [data, setData] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [statusFilters, setStatusFilters] = useState<string[]>(["In Stock", "Low Stock", "Out of Stock"])

  // Debounce search to prevent excessive API calls
  const debouncedSearch = useDebounce(search, 500)

  const fetchInventory = useCallback(async () => {
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

      if (statusFilters.length > 0) {
        statusFilters.forEach(status => {
          params.append("stock_status", status)
        })
      }
      
      const response = await fetch(
        `http://localhost:8000/inventory?${params.toString()}`
      )
      
      if (!response.ok) {
        throw new Error('Failed to fetch inventory data')
      }
      
      const result: InventoryResponse = await response.json()
      
      setData(result.items)
      setTotalPages(result.pages)
      setTotalItems(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setData([])
    } finally {
      setLoading(false)
    }
  }, [pagination.pageIndex, pagination.pageSize, debouncedSearch, sortBy, sortOrder, statusFilters])

  useEffect(() => {
    fetchInventory()
  }, [fetchInventory])

  // Reset to first page when search or filters change
  useEffect(() => {
    if (pagination.pageIndex !== 0) {
      setPagination(prev => ({ ...prev, pageIndex: 0 }))
    }
  }, [debouncedSearch, statusFilters, sortBy, sortOrder])

  return (
    <div className="container mx-auto p-4">
      {error && (
        <div className="mb-4 rounded-md bg-destructive/15 p-4 text-destructive">
          Error: {error}
        </div>
      )}
      <DataTable
        columns={columns}
        data={data}
        loading={loading}
        pagination={pagination}
        onPaginationChange={setPagination}
        totalPages={totalPages}
        totalItems={totalItems}
        search={search}
        onSearchChange={setSearch}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={(newSortBy, newSortOrder) => {
          setSortBy(newSortBy)
          setSortOrder(newSortOrder)
        }}
        statusFilters={statusFilters}
        onStatusFiltersChange={setStatusFilters}
      />
    </div>
  )
}
