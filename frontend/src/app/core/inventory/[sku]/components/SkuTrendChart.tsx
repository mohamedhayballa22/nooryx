"use client"

import React, { useMemo } from "react"
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
import { ChevronDown } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { EmptyTrend } from "@/components/empty-trend"

import type { InventoryTrend } from "@/lib/api/inventory"

type PeriodKey = "7d" | "31d" | "180d" | "365d"

interface SkuTrendChartProps {
  inventoryTrend: InventoryTrend
  period: PeriodKey
  onPeriodChange: (value: PeriodKey) => void
}

export default function SkuTrendChart({ inventoryTrend, period, onPeriodChange}: SkuTrendChartProps) {
  const periodLabelMap: Record<PeriodKey, string> = {
    "7d": "Last Week",
    "31d": "Last Month",
    "180d": "Last 6 Months",
    "365d": "Last Year",
  }

  const hasInsufficientData = useMemo(() => {
    if (inventoryTrend.points.length < 2) {
      return true
    }

    const firstValue = inventoryTrend.points[0].on_hand
    const allSame = inventoryTrend.points.every(point => point.on_hand === firstValue)

    // Only consider flat data as insufficient if oldest data point is within the last 7 days
    if (allSame) {
      const oldest = new Date(inventoryTrend.oldest_data_point)
      const now = new Date()
      const daysDiff = Math.floor((now.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24))
      
      return daysDiff <= 7
    }

    return false
  }, [inventoryTrend.points, inventoryTrend.oldest_data_point])

  const validPeriods = useMemo(() => {
    if (hasInsufficientData) {
      return { "7d": false, "31d": false, "180d": false, "365d": false } as Record<PeriodKey, boolean>
    }

    const oldest = new Date(inventoryTrend.oldest_data_point)
    const now = new Date()
    const daysDiff = Math.floor((now.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24))

    return {
      "7d": daysDiff > 0,
      "31d": daysDiff > 7,
      "180d": daysDiff > 31,
      "365d": daysDiff > 180,
    } as Record<PeriodKey, boolean>
  }, [inventoryTrend.oldest_data_point, hasInsufficientData])

  const displayPeriod = hasInsufficientData ? "7d" : period

  const chartConfig = {
    on_hand: {
      label: "On Hand",
      color: "var(--on-hand)",
    },
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 flex flex-row items-start justify-between">
        <div>
          <CardTitle>Inventory Trend - {inventoryTrend.sku}</CardTitle>
          <CardDescription className="mt-1.5">
            {inventoryTrend.location
              ? `${inventoryTrend.location}`
              : inventoryTrend.locations === 1
              ? `Single Location view`
              : "All Locations"}
          </CardDescription>
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
            {(Object.entries(periodLabelMap) as [PeriodKey, string][]).map(([key, label]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => validPeriods[key] && onPeriodChange(key)}
                disabled={!validPeriods[key]}
                className={period === key ? "font-medium text-primary" : undefined}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="flex-1 min-h-0">
        {hasInsufficientData ? (
          <EmptyTrend />
        ) : (
          <ChartContainer config={chartConfig} className="h-full w-full">
            <AreaChart
              accessibilityLayer
              data={inventoryTrend.points}
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
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }}
              />
              <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
              <defs>
                <linearGradient id="fillOnHand" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--on-hand)" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="var(--on-hand)" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <Area
                dataKey="on_hand"
                type="natural"
                fill="url(#fillOnHand)"
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

SkuTrendChart.Skeleton = function SkuTrendChartSkeleton() {
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
