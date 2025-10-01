"use client"

import { useCallback, useEffect, useRef, useState } from "react"

export interface TransactionItem {
  id: number
  date: string
  actor: string
  action: string
  quantity: number
  sku: string
  location?: string
  from_location?: string
  to_location?: string
  stock_before: number
  stock_after: number
  metadata?: Record<string, any> | null
}

export interface TransactionsResponse {
  items: TransactionItem[]
  total: number
  page: number
  size: number
  pages: number
}

export function useTransactions(
  initialPageIndex = 0,
  initialPageSize = 10
) {
  const [pageIndex, setPageIndex] = useState<number>(initialPageIndex)
  const [pageSize, setPageSizeState] = useState<number>(initialPageSize)

  const [items, setItems] = useState<TransactionItem[]>([])
  const [totalItems, setTotalItems] = useState<number>(0)
  const [totalPages, setTotalPages] = useState<number>(0)

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  // to avoid race conditions
  const abortRef = useRef<AbortController | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      abortRef.current?.abort()
    }
  }, [])

  // When pageSize changes we reset to first page
  const setPageSize = useCallback((size: number) => {
    setPageSizeState(size)
    setPageIndex(0)
  }, [])

  const fetchPage = useCallback(
    async (pageIdx = pageIndex, size = pageSize) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setLoading(true)
      setError(null)

      try {
        const apiPage = pageIdx + 1

        const url = `http://localhost:8000/transactions?page=${apiPage}&size=${size}`

        const res = await fetch(url, { signal: controller.signal })

        if (!res.ok) {
          throw new Error(`Failed to fetch transactions: ${res.status} ${res.statusText}`)
        }

        const data: TransactionsResponse = await res.json()

        if (!mountedRef.current) return

        setItems(data.items ?? [])
        setTotalItems(data.total ?? 0)
        setTotalPages(data.pages ?? Math.max(1, Math.ceil((data.total ?? 0) / (data.size ?? size))))

        // keep local pageIndex in sync with backend (backend returns 1-based page)
        const backendPageIndex = Math.max(0, (data.page ?? apiPage) - 1)
        if (backendPageIndex !== pageIdx) {
          setPageIndex(backendPageIndex)
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          // aborted -> ignore
          return
        }
        setError(err)
      } finally {
        if (mountedRef.current) setLoading(false)
      }
    },
    [pageIndex, pageSize]
  )

  // auto-fetch when pageIndex/size change
  useEffect(() => {
    fetchPage(pageIndex, pageSize)
  }, [pageIndex, pageSize])

  const refetch = useCallback(() => fetchPage(pageIndex, pageSize), [fetchPage, pageIndex, pageSize])

  return {
    items,
    totalItems,
    totalPages,
    pageIndex,
    pageSize,
    loading,
    error,
    setPageIndex,
    setPageSize,
    refetch,
  }
}
