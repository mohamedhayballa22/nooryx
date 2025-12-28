"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { RefreshCw, ArrowUp, ArrowDown, Calendar, ArrowUpDown, Check, ChevronDown } from "lucide-react"
import { useEffect, useState } from "react"
import { useFormatting } from "@/hooks/use-formatting"
import { subMonths, subYears, formatDistanceToNow } from "date-fns"

interface COGSHeaderProps {
  total_cogs: number
  currency: string
  delta_percentage?: number | null
  timestamp: string
  selectedPeriod: string
  onRefresh?: () => void | Promise<void>
  onPeriodChange?: (startDate: string, period: string) => void
  isRefreshing?: boolean
}

type PeriodOption = {
  value: string
  label: string
  comparisonLabel?: string
  getStartDate: () => Date
}

const PERIOD_OPTIONS: PeriodOption[] = [
  {
    value: "last_month",
    label: "Last Month",
    comparisonLabel: "Previous Month",
    getStartDate: () => subMonths(new Date(), 1),
  },
  {
    value: "last_3_months",
    label: "Last 3 Months",
    comparisonLabel: "Previous 3 Months",
    getStartDate: () => subMonths(new Date(), 3),
  },
  {
    value: "last_6_months",
    label: "Last 6 Months",
    comparisonLabel: "Previous 6 Months",
    getStartDate: () => subMonths(new Date(), 6),
  },
  {
    value: "last_year",
    label: "Last Year",
    comparisonLabel: "Previous Year",
    getStartDate: () => subYears(new Date(), 1),
  },
  {
    value: "all_time",
    label: "All Time",
    comparisonLabel: undefined,
    getStartDate: () => new Date(0),
  },
]

export function COGSHeader({ 
  total_cogs,
  delta_percentage,
  timestamp,
  selectedPeriod,
  onRefresh,
  onPeriodChange,
  isRefreshing = false 
}: COGSHeaderProps) {
  const adjustedTimestamp = Math.min(new Date(timestamp).getTime(), Date.now())
  
  const { formatCurrency, formatQuantity } = useFormatting()
  
  const COOLDOWN_MS = 10000 // 10 seconds
  
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0)
  const [isInCooldown, setIsInCooldown] = useState(false)

  const isPeriodSelectorDisabled = total_cogs === 0
  
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

  const handlePeriodChange = (value: string) => {
    if (onPeriodChange) {
      const period = PERIOD_OPTIONS.find(p => p.value === value)
      if (period) {
        const startDate = period.getStartDate()
        onPeriodChange(startDate.toISOString(), value)
      }
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

  const formatDelta = (delta?: number | null) => {
    if (delta === undefined || delta === null || delta === 0) {
      return {
        value: "N/A",
        isNA: true,
        icon: ArrowUpDown,
        colorClass: "text-muted-foreground bg-muted border-border"
      }
    }
    
    const isPositive = delta > 0
    const isNegative = delta < 0
    
    return {
      value: formatQuantity(Math.abs(delta), 1),
      isPositive,
      isNegative,
      isNA: false,
      icon: isPositive ? ArrowUp : isNegative ? ArrowDown : ArrowUpDown,
      colorClass: "text-muted-foreground bg-muted border-border"
    }
  }

  const deltaInfo = formatDelta(delta_percentage)
  const currentPeriod = PERIOD_OPTIONS.find(p => p.value === selectedPeriod)
  const comparisonLabel = currentPeriod?.comparisonLabel
  const showComparisonLabel = comparisonLabel && !deltaInfo.isNA

  return (
    <div className="space-y-6">
      {/* COGS Display */}
      <Card className="relative overflow-hidden">
        {/* Subtle background gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-muted/20 via-transparent to-transparent" />

        {/* Top Right Controls */}
        <div className="absolute right-4 top-4 z-10 flex items-center gap-2 mt-1">
          {/* Period Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer px-2 md:px-3"
                disabled={isPeriodSelectorDisabled}
              >
                <span className="md:hidden">
                  <Calendar className="h-4 w-4" />
                </span>
                <span className="hidden md:flex items-center gap-1.5">
                  {currentPeriod?.label || "Select Period"}
                  <ChevronDown className="h-4 w-4" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {PERIOD_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handlePeriodChange(option.value)}
                  className={
                    selectedPeriod === option.value ? "font-medium text-primary" : undefined
                  }
                >
                  {option.label}
                  <Check className={`ml-auto h-4 w-4 ${selectedPeriod === option.value ? "opacity-100" : "opacity-0"}`} />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefreshClick}
              disabled={isButtonDisabled}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="sr-only">Refresh COGS data</span>
            </Button>
          )}
        </div>

        <CardContent className="relative space-y-6">
          {/* Delta Badge with comparison period */}
          <div className="flex items-center gap-2">
            {deltaInfo ? (
              <div className="flex items-center gap-2">
                <Badge 
                  variant="outline" 
                  className={`rounded-md px-2.5 py-0.5 text-xs font-medium ${deltaInfo.colorClass}`}
                >
                  {deltaInfo.icon && <deltaInfo.icon className="mr-1 h-3 w-3" />}
                  {deltaInfo.isNA ? (
                    deltaInfo.value
                  ) : (
                    <>
                      {deltaInfo.isPositive && "+"}
                      {deltaInfo.isNegative && "-"}
                      {deltaInfo.value}%
                    </>
                  )}
                </Badge>
                {showComparisonLabel && (
                  <span className="text-xs text-muted-foreground">vs {comparisonLabel}</span>
                )}
              </div>
            ) : (
              <div className="h-5" />
            )}
          </div>

          {/* Total COGS */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Cost of Goods Sold
            </p>
            <p className="break-words font-mono text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
              {formatCurrency(total_cogs)}
            </p>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="relative flex h-2 w-2 items-center justify-center mt-0.5">
              <div className={`absolute h-full w-full rounded-full ${isRefreshing ? "bg-yellow-500 animate-ping" : "bg-green-500 animate-ping"}`} />
              <div className={`relative h-2 w-2 rounded-full ${isRefreshing ? "bg-yellow-500" : "bg-green-500"}`} />
            </div>
            <span>{isRefreshing ? "Updating..." : "Live data"}</span>
            {!isRefreshing && (
              <>
                <div className="h-3 w-px bg-border" />
                <span>
                  Updated{" "}
                  {(() => {
                    const t = formatDistanceToNow(adjustedTimestamp, { addSuffix: true });
                    return t === "less than a minute ago" ? "just now" : t;
                  })()}
                </span>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

COGSHeader.Skeleton = function COGSHeaderSkeleton() {
  return (
    <div className="space-y-6">
      {/* COGS Display */}
      <Card className="relative overflow-hidden">
        {/* Subtle background gradient */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-muted/20 via-transparent to-transparent" />

        <CardContent className="relative space-y-6">
          {/* Delta Badge */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-md" />
            <Skeleton className="h-3 w-20" />
          </div>

          {/* Total COGS */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-14 w-64 sm:h-[72px]" />
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-1.5 w-1.5 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="h-3 w-px bg-border" />
            <Skeleton className="h-3 w-32" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
