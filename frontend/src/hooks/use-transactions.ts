"use client"

import { useState, useEffect } from "react"
import { useDebounce } from "@/hooks/use-debounce"
import { PaginationState } from "@tanstack/react-table"

export interface TransactionItem {
  id: number
  date: string
  actor: string
  action: string
  quantity: number
  sku: string
  location?: string
  stock_before: number
  stock_after: number
  metadata?: {
    target_location?: string
    source_location?: string
    [key: string]: any
  } | null
}

export interface TransactionsResponse {
  items: TransactionItem[]
  total: number
  page: number
  size: number
  pages: number
}

const INITIAL_PAGINATION: PaginationState = { pageIndex: 0, pageSize: 10 }
const INITIAL_ACTION_FILTERS = [
  "added",
  "shipped",
  "reserved",
  "transferred",
  "adjusted",
  "unreserved",
]

export function useTransactions() {
  const [data, setData] = useState<TransactionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Controls
  const [pagination, setPagination] = useState<PaginationState>(INITIAL_PAGINATION)
  const [totalPages, setTotalPages] = useState(0)
  const [totalItems, setTotalItems] = useState(0)

  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const [actionFilters, setActionFilters] = useState<string[]>(INITIAL_ACTION_FILTERS)

  const debouncedSearch = useDebounce(search, 500)

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    const fetchTransactions = async () => {
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
        actionFilters.forEach((action) => {
          params.append("action", action)
        })

        const response = await fetch(
          `http://localhost:8000/transactions?${params.toString()}`,
          { signal }
        )

        if (!response.ok) {
          throw new Error("Failed to fetch transactions")
        }

        const result: TransactionsResponse = await response.json()
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

    fetchTransactions()
    return () => controller.abort()
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    debouncedSearch,
    sortBy,
    sortOrder,
    actionFilters,
  ])

  // Reset to page 0 when filters/search/sort change
  useEffect(() => {
    if (pagination.pageIndex !== 0) {
      setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    }
  }, [debouncedSearch, actionFilters, sortBy, sortOrder])

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

    actionFilters,
    onActionFiltersChange: setActionFilters,
  }
}
