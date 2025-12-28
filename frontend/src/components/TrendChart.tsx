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
import { ChevronDown } from "lucide-react"
import { EmptyTrend } from "@/components/empty-trend"
import { Skeleton } from "@/components/ui/skeleton"

import type { InventoryTrend } from "@/lib/api/inventory"
import { useFormatting } from "@/hooks/use-formatting"

type PeriodKey = "7d" | "31d" | "180d" | "365d"

interface TrendChartProps {
  inventoryTrend: InventoryTrend
  period: PeriodKey
  onPeriodChange: (value: PeriodKey) => void
}

const PureChartArea = React.memo(function PureChartArea({ 
  data, 
  formatDate, 
  locale 
}: { 
  data: any[], 
  formatDate: (d: string | number | Date) => string,
  locale: string 
}) {
  
  const axisFormatter = useMemo(() => {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
    })
  }, [locale])

  const yDomain = useMemo(() => {
    if (data.length === 0) return [0, 'auto']
    
    const values = data.map(d => d.on_hand)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min
    
    const padding = Math.max(range * 0.1, 1)
    
    return [
      Math.floor(min - padding),
      Math.ceil(max + padding)
    ]
  }, [data])

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
          width={40} // Add fixed width to prevent label cutoff
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
              labelFormatter={(value, payload) => {
                const timestamp = payload?.[0]?.payload?.date
                return formatDate(timestamp ?? value) 
              }} 
            />
          } 
        />
        <defs>
          <linearGradient id="fillOnHand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--on-hand)" stopOpacity={0.8} />
            <stop offset="95%" stopColor="var(--on-hand)" stopOpacity={0.1} />
          </linearGradient>
        </defs>
        <Area
          dataKey="on_hand"
          type="monotone"
          fill="url(#fillOnHand)"
          fillOpacity={0.4}
          stroke="var(--on-hand)"
          strokeWidth={2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
})

export const TrendChart = React.memo(function TrendChart({
  inventoryTrend,
  period,
  onPeriodChange,
}: TrendChartProps) {
  const { formatDate, locale } = useFormatting()

  const optimizedData = useMemo(() => {
    if (!inventoryTrend?.points) return []
    return inventoryTrend.points.map(point => ({
      ...point,
      date: new Date(point.date).getTime() 
    }))
  }, [inventoryTrend.points])

  const { hasInsufficientData, validPeriods } = useMemo(() => {
    if (!inventoryTrend.points || inventoryTrend.points.length < 2) {
      return { 
        hasInsufficientData: true, 
        validPeriods: { "7d": false, "31d": false, "180d": false, "365d": false } 
      }
    }

    const firstValue = inventoryTrend.points[0].on_hand
    const allSame = inventoryTrend.points.every((p) => p.on_hand === firstValue)
    
    const oldestTime = new Date(inventoryTrend.oldest_data_point).getTime()
    const nowTime = Date.now()
    const daysDiff = (nowTime - oldestTime) / (1000 * 60 * 60 * 24)

    if (allSame && daysDiff <= 7) {
      return { 
        hasInsufficientData: true, 
        validPeriods: { "7d": false, "31d": false, "180d": false, "365d": false } 
      }
    }

    return {
      hasInsufficientData: false,
      validPeriods: {
        "7d": daysDiff > 0,
        "31d": daysDiff > 7,
        "180d": daysDiff > 31,
        "365d": daysDiff > 180,
      } as Record<PeriodKey, boolean>
    }
  }, [inventoryTrend.points, inventoryTrend.oldest_data_point])

  const periodLabelMap: Record<PeriodKey, string> = {
    "7d": "Last Week",
    "31d": "Last Month",
    "180d": "Last 6 Months",
    "365d": "Last Year",
  }

  const displayPeriod = validPeriods[period] ? period : "7d"

  const chartConfig = {
    on_hand: {
      label: "On Hand",
      color: "var(--on-hand)",
    },
  }

  const title = inventoryTrend.sku_code
    ? `Inventory Trend - ${inventoryTrend.sku_code}`
    : "Inventory Trend"

  const description = inventoryTrend.location
    ? inventoryTrend.location
    : "All Locations"

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 flex flex-row items-start justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription className="mt-1.5">{description}</CardDescription>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto cursor-pointer"
              disabled={hasInsufficientData}
            >
              {periodLabelMap[displayPeriod]}
              <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
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
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="flex-1 min-h-0">
        {hasInsufficientData ? (
          <EmptyTrend />
        ) : (
          <ChartContainer config={chartConfig} className="h-full w-full">
            <PureChartArea 
              data={optimizedData} 
              formatDate={formatDate}
              locale={locale}
            />
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}) as React.NamedExoticComponent<TrendChartProps> & {
  Skeleton: React.FC
}

TrendChart.Skeleton = function TrendChartSkeleton() {
  return (
    <Card className="h-full flex flex-col animate-pulse">
      <CardHeader className="flex-shrink-0 flex flex-row items-start justify-between">
        <div>
          <Skeleton className="h-5 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
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

export default TrendChart
