"use client"

import React, { useMemo } from "react"
import { AreaChart, Area, XAxis, CartesianGrid, ResponsiveContainer, YAxis } from "recharts"
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
import { EmptyTrend } from "@/components/empty-trend"
import { Skeleton } from "@/components/ui/skeleton"

import type { COGSTrendResponse } from "@/lib/api/valuation"
import { useFormatting } from "@/hooks/use-formatting"

type PeriodKey = "7d" | "30d" | "90d" | "180d" | "1y"
type GranularityKey = "daily" | "weekly" | "monthly"

interface COGSTrendChartProps {
  cogsTrend: COGSTrendResponse
  period: PeriodKey
  granularity: GranularityKey
  onPeriodChange: (value: PeriodKey) => void
  onGranularityChange: (value: GranularityKey) => void
}

const PureChartArea = React.memo(function PureChartArea({ 
  data, 
  formatDate,
  formatCurrency,
  locale,
  granularity
}: { 
  data: any[], 
  formatDate: (d: string | number | Date) => string,
  formatCurrency: (value: number) => string,
  locale: string,
  granularity: GranularityKey
}) {
  
  const axisFormatter = useMemo(() => {
    return new Intl.DateTimeFormat(locale, 
      granularity === "monthly" 
        ? { month: "short", year: "numeric" }
        : { month: "short", day: "numeric" }
    )
  }, [locale, granularity])

  const yDomain = useMemo(() => {
    if (data.length === 0) return [0, 'auto']
    
    const values = data.map(d => d.cogs)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min
    
    const padding = Math.max(range * 0.1, 1)
    
    return [
      Math.floor(min - padding),
      Math.ceil(max + padding)
    ]
  }, [data])

  const tooltipLabelFormatter = useMemo(() => {
    return (value: any, payload: any) => {
      const timestamp = payload?.[0]?.payload?.date
      const date = new Date(timestamp ?? value)
      
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
      return formatDate(timestamp ?? value)
    }
  }, [granularity, locale, formatDate])

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={200}>
      <AreaChart
        accessibilityLayer
        data={data}
        margin={{ left: 4, right: 12, top: 20 }}
      >
        <CartesianGrid vertical={false} />
        
        <YAxis 
          domain={yDomain as [number, number]}
          hide={false}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          width={40}
        />
        
        <XAxis
          dataKey="date" 
          type="number" 
          domain={['dataMin', 'dataMax']} 
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={30}
          tickFormatter={axisFormatter.format} 
        />
        
        <ChartTooltip 
          cursor={false} 
          content={
            <ChartTooltipContent 
              formatter={(value) => formatCurrency(value as number)}
              labelFormatter={tooltipLabelFormatter} 
            />
          } 
        />
        <defs>
          <linearGradient id="fillCOGS" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--on-hand)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--on-hand)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <Area
          dataKey="cogs"
          type="monotone"
          fill="url(#fillCOGS)"
          fillOpacity={0.4}
          stroke="var(--on-hand)"
          strokeWidth={2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
})

export const COGSTrendChart = React.memo(function COGSTrendChart({
  cogsTrend,
  period,
  granularity,
  onPeriodChange,
  onGranularityChange,
}: COGSTrendChartProps) {
  const { formatDate, formatCurrency, locale } = useFormatting()

  const optimizedData = useMemo(() => {
    if (!cogsTrend?.points) return []
    return cogsTrend.points.map(point => ({
      ...point,
      date: new Date(point.date).getTime() 
    }))
  }, [cogsTrend.points])

  const { hasInsufficientData, validPeriods } = useMemo(() => {
    if (!cogsTrend.points || cogsTrend.points.length < 2) {
      return { 
        hasInsufficientData: true, 
        validPeriods: { "7d": false, "30d": false, "90d": false, "180d": false, "1y": false } 
      }
    }

    const firstValue = cogsTrend.points[0].cogs
    const allSame = cogsTrend.points.every((p) => p.cogs === firstValue)
    
    const oldestTime = new Date(cogsTrend.oldest_data_point).getTime()
    const nowTime = Date.now()
    const daysDiff = (nowTime - oldestTime) / (1000 * 60 * 60 * 24)

    if (allSame && daysDiff <= 7) {
      return { 
        hasInsufficientData: true, 
        validPeriods: { "7d": false, "30d": false, "90d": false, "180d": false, "1y": false } 
      }
    }

    // Only enable period selection for daily granularity
    if (granularity !== "daily") {
      return {
        hasInsufficientData: false,
        validPeriods: { "7d": false, "30d": false, "90d": false, "180d": false, "1y": false }
      }
    }

    return {
      hasInsufficientData: false,
      validPeriods: {
        "7d": daysDiff > 0,
        "30d": daysDiff > 7,
        "90d": daysDiff > 30,
        "180d": daysDiff > 90,
        "1y": daysDiff > 180,
      } as Record<PeriodKey, boolean>
    }
  }, [cogsTrend.points, cogsTrend.oldest_data_point, granularity])

  const periodLabelMap: Record<PeriodKey, string> = {
    "7d": "Last Week",
    "30d": "Last Month",
    "90d": "Last 3 Months",
    "180d": "Last 6 Months",
    "1y": "Last Year",
  }

  const granularityLabelMap: Record<GranularityKey, string> = {
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
  }

  const displayPeriod = granularity !== "daily" 
    ? "1y" 
    : (validPeriods[period] ? period : "7d")
  const isPeriodDisabled = granularity !== "daily" || hasInsufficientData

  const chartConfig = {
    cogs: {
      label: "COGS",
      color: "var(--on-hand)",
    },
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 flex flex-row items-start justify-between">
        <div>
          <CardTitle>COGS Trend</CardTitle>
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
                <span className="md:hidden">
                  <SlidersHorizontal className="h-4 w-4" />
                </span>
                <span className="hidden md:flex items-center">
                  {granularityLabelMap[granularity]}
                  <ChevronDown className="ml-2 h-4 w-4" />
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
                <span className="md:hidden">
                  <Calendar className="h-4 w-4" />
                </span>
                <span className="hidden md:flex items-center">
                  {periodLabelMap[displayPeriod]}
                  <ChevronDown className="ml-2 h-4 w-4" />
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
            <PureChartArea 
              data={optimizedData} 
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              locale={locale}
              granularity={granularity}
            />
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}) as React.NamedExoticComponent<COGSTrendChartProps> & {
  Skeleton: React.FC
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
          <div className="relative w-full h-90">
            <Skeleton className="absolute bottom-0 left-0 w-full h-2/3 rounded-t-full" />
            <Skeleton className="absolute bottom-0 left-1/4 w-1/2 h-3/4 opacity-70 rounded-t-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default COGSTrendChart
