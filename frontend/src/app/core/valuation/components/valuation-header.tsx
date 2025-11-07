"use client"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { useFormatting } from "@/hooks/use-formatting"
import { formatDistanceToNow } from "date-fns"

interface ValuationHeaderProps {
  total_value: number
  currency: string
  method: string
  method_full_name: string
  timestamp: string // ISO 8601 timestamp
  onRefresh?: () => void | Promise<void>
  isRefreshing?: boolean
}

export function ValuationHeader({ 
  total_value, 
  method, 
  method_full_name, 
  timestamp, 
  onRefresh,
  isRefreshing = false 
}: ValuationHeaderProps) {
  const adjustedTimestamp = Math.min(new Date(timestamp).getTime(), Date.now())
  
  const { formatCurrency } = useFormatting()
  
  const COOLDOWN_MS = 10000 // 10 seconds
  
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0)
  const [isInCooldown, setIsInCooldown] = useState(false)
  
  const handleRefreshClick = async () => {
    const now = Date.now()
    const timeSinceLastRefresh = now - lastRefreshTime
    
    if (timeSinceLastRefresh < COOLDOWN_MS || isInCooldown) {
      return
    }

    setLastRefreshTime(now)
    setIsInCooldown(true)
    
    if (onRefresh) {
      await onRefresh()
    }
  }

  useEffect(() => {
    if (!isInCooldown) return

    const timer = setTimeout(() => {
      setIsInCooldown(false)
    }, COOLDOWN_MS)

    return () => clearTimeout(timer)
  }, [isInCooldown])

  const isButtonDisabled = isRefreshing || isInCooldown

  return (
    <div className="space-y-6">
      {/* Hero Value Display */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6">
        {/* Subtle background gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-muted/20 via-transparent to-transparent" />

        {/* Refresh Button - increased z-index */}
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefreshClick}
            disabled={isButtonDisabled}
            className="absolute right-4 top-4 z-10 h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            <span className="sr-only">Refresh data</span>
          </Button>
        )}

        <div className="relative space-y-6">
          {/* Method Badge */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="rounded-md px-2.5 py-0.5 text-xs font-medium">
              {method}
            </Badge>
            <span className="text-xs text-muted-foreground">{method_full_name}</span>
          </div>

          {/* Total Value */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Total Inventory Value</p>
            <p className="text-balance font-mono text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              {formatCurrency(total_value)}
            </p>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="relative flex h-2 w-2 items-center justify-center mt-0.5">
              <div className={`absolute h-full w-full rounded-full ${isRefreshing ? "bg-yellow-500 animate-ping" : "bg-green-500 animate-ping"}`} />
              <div className={`relative h-2 w-2 rounded-full ${isRefreshing ? "bg-yellow-500" : "bg-green-500"}`} />
            </div>
            <span>{isRefreshing ? "Updating..." : "Live data"}</span>
            {!isRefreshing && (
              <>
                <div className="h-3 w-px bg-border" />
                <span>Updated {formatDistanceToNow(adjustedTimestamp, { addSuffix: true })}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

ValuationHeader.Skeleton = function ValuationHeaderSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero Value Display */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6">
        {/* Subtle background gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-muted/20 via-transparent to-transparent" />

        <div className="relative space-y-6">
          {/* Method Badge */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-3 w-32" />
          </div>

          {/* Total Value */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-14 w-64 sm:h-[72px]" />
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-1.5 w-1.5 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="h-3 w-px bg-border" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </div>
    </div>
  )
}
