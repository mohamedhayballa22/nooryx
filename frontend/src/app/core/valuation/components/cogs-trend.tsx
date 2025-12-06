"use client"

import { useMemo, useEffect } from "react"
import { AreaChart, Area, XAxis, CartesianGrid } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown, Calendar, SlidersHorizontal, Check } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyTrend } from "@/components/empty-trend"

import type { COGSTrendResponse } from "@/lib/api/valuation"
import { useFormatting } from "@/hooks/use-formatting"

type PeriodKey = "7d" | "30d" | "90d" | "180d"
type GranularityKey = "daily" | "weekly" | "monthly"

interface COGSTrendChartProps {
  cogsTrend: COGSTrendResponse
  period: PeriodKey
  granularity: GranularityKey
  onPeriodChange: (value: PeriodKey) => void
  onGranularityChange: (value: GranularityKey) => void
}

export default function COGSTrendChart({
  cogsTrend,
  period,
  granularity,
  onPeriodChange,
  onGranularityChange,
}: COGSTrendChartProps) {
  const { formatDate, formatCurrency, locale } = useFormatting()
  
  const periodLabelMap: Record<PeriodKey, string> = {
    "7d": "Last Week",
    "30d": "Last Month",
    "90d": "Last 3 Months",
    "180d": "Last 6 Months",
  }

  const granularityLabelMap: Record<GranularityKey, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
  }

  const hasInsufficientData = useMemo(() => {
    if (cogsTrend.points.length < 2) return true

    const firstValue = cogsTrend.points[0].cogs
    const allSame = cogsTrend.points.every(
      (point) => point.cogs === firstValue
    )

    if (allSame) {
      const oldest = new Date(cogsTrend.oldest_data_point)
      const now = new Date()
      const daysDiff = Math.floor(
        (now.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24)
      )
      return daysDiff <= 7
    }

    return false
  }, [cogsTrend.points, cogsTrend.oldest_data_point])

  const validPeriods = useMemo(() => {
    if (hasInsufficientData || granularity !== "daily") {
      return {
        "7d": false,
        "30d": false,
        "90d": false,
        "180d": false,
      } as Record<PeriodKey, boolean>
    }

    const oldest = new Date(cogsTrend.oldest_data_point)
    const now = new Date()
    const daysDiff = Math.floor(
      (now.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24)
    )

    return {
      "7d": daysDiff > 0,
      "30d": daysDiff > 7,
      "90d": daysDiff > 30,
      "180d": daysDiff > 90,
    } as Record<PeriodKey, boolean>
  }, [cogsTrend.oldest_data_point, hasInsufficientData, granularity])

  // Auto-adjust period to closest valid option
  useEffect(() => {
    if (hasInsufficientData || granularity !== "daily") return
    
    if (!validPeriods[period]) {
      const periodOrder: PeriodKey[] = ["180d", "90d", "30d", "7d"]
      const currentIndex = periodOrder.indexOf(period)
      
      for (let i = currentIndex + 1; i < periodOrder.length; i++) {
        if (validPeriods[periodOrder[i]]) {
          onPeriodChange(periodOrder[i])
          return
        }
      }
    }
  }, [period, validPeriods, hasInsufficientData, granularity, onPeriodChange])

  const displayPeriod = hasInsufficientData ? "7d" : period

  const chartConfig = {
    cogs: {
      label: "COGS",
      color: "var(--on-hand)",
    },
  }

  const isPeriodDisabled = granularity !== "daily" || hasInsufficientData

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 flex flex-row items-start justify-between">
        <div>
          <CardTitle>COGS Trend</CardTitle>
          {/* Hide description on mobile, show on medium screens and up */}
          <CardDescription className="mt-1.5 hidden md:block">
            Cost of Goods Sold Over Time
          </CardDescription>
        </div>

        <div className="flex gap-2">
          {/* Granularity Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer px-2 md:px-3 -mt-2 md:mt-0"
              >
                {/* Mobile View: Icon Only in isolated span */}
                <span className="md:hidden">
                  <SlidersHorizontal className="h-4 w-4" />
                </span>

                {/* Desktop View: Text + Chevron */}
                <span className="hidden md:flex items-center">
                  {granularityLabelMap[granularity]}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {(Object.entries(granularityLabelMap) as [GranularityKey, string][]).map(
                    ([key, label]) => (
                    <DropdownMenuItem
                        key={key}
                        onClick={() => onGranularityChange(key)}
                        className={
                        granularity === key ? "font-medium text-primary" : undefined
                        }
                    >
                        {label}
                        <Check className={`ml-auto h-4 w-4 ${granularity === key ? "opacity-100" : "opacity-0"}`} />
                    </DropdownMenuItem>
                    )
                )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Period Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="cursor-pointer px-2 md:px-3 -mt-2 md:mt-0"
                disabled={isPeriodDisabled}
              >
                {/* Mobile View: Icon Only in isolated span */}
                <span className="md:hidden">
                  <Calendar className="h-4 w-4" />
                </span>

                {/* Desktop View: Text + Chevron */}
                <span className="hidden md:flex items-center">
                  {periodLabelMap[displayPeriod]}
                  <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {(Object.entries(periodLabelMap) as [PeriodKey, string][]).map(
                    ([key, label]) => (
                    <DropdownMenuItem
                        key={key}
                        onClick={() => validPeriods[key] && onPeriodChange(key)}
                        disabled={!validPeriods[key]}
                        className={
                        period === key ? "font-medium text-primary" : undefined
                        }
                    >
                        {label}
                        <Check className={`ml-auto h-4 w-4 ${period === key ? "opacity-100" : "opacity-0"}`} />
                    </DropdownMenuItem>
                    )
                )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-0">
        {hasInsufficientData ? (
          <EmptyTrend />
        ) : (
          <ChartContainer config={chartConfig} className="h-full w-full">
            <AreaChart
              accessibilityLayer
              data={cogsTrend.points}
              margin={{ left: 12, right: 12, top: 20 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tickFormatter={(value) => {
                  const date = new Date(value)
                  if (granularity === "monthly") {
                    return date.toLocaleDateString(locale, {
                      month: "short",
                      year: "numeric",
                    })
                  }
                  return date.toLocaleDateString(locale, {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <ChartTooltip 
                cursor={false} 
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(value as number)}
                    labelFormatter={(label) => {
                      const date = new Date(label)
                      if (granularity === "monthly") {
                        return date.toLocaleDateString(locale, {
                          month: "long",
                          year: "numeric",
                        })
                      }
                      if (granularity === "weekly") {
                        return `Week of ${date.toLocaleDateString(locale, {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}`
                      }
                      return formatDate(label)
                    }}
                  />
                } 
              />
              <defs>
                <linearGradient id="fillCOGS" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--on-hand)"
                    stopOpacity={0.8}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--on-hand)"
                    stopOpacity={0.1}
                  />
                </linearGradient>
              </defs>
              <Area
                dataKey="cogs"
                type="monotone"
                fill="url(#fillCOGS)"
                fillOpacity={0.4}
                stroke="var(--on-hand)"
                strokeWidth={2}
                dot={{
                  fill: "var(--on-hand)",
                  stroke: "var(--on-hand)",
                  strokeWidth: 0,
                  r: 2,
                  fillOpacity: 1,
                }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

COGSTrendChart.Skeleton = function COGSTrendChartSkeleton() {
  return (
    <Card className="h-full flex flex-col animate-pulse">
      <CardHeader className="flex-shrink-0 flex flex-row items-start justify-between">
        <div>
          <Skeleton className="h-5 w-32 mb-2" />
          <Skeleton className="h-4 w-48 hidden md:block" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 md:w-24 rounded-md" />
          <Skeleton className="h-8 w-8 md:w-28 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <div className="h-full w-full flex items-center justify-center">
          <div className="relative w-full h-48">
            <Skeleton className="absolute bottom-0 left-0 w-full h-2/3 rounded-t-full" />
            <Skeleton className="absolute bottom-0 left-1/4 w-1/2 h-3/4 opacity-70 rounded-t-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
