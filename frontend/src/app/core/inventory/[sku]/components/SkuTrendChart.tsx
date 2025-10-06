"use client"

import React from "react"
import { AreaChart, Area, XAxis, CartesianGrid } from "recharts"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { InventoryTrend } from "@/lib/api/inventory"

interface SkuTrendChartProps {
  inventoryTrend: InventoryTrend
}

const chartConfig = {
  on_hand: {
    label: "On Hand",
    color: "#00afc7ff",
  },
} satisfies ChartConfig

const SkuTrendChart: React.FC<SkuTrendChartProps> = ({ inventoryTrend }) => {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle>Inventory Trend - {inventoryTrend.sku}</CardTitle>
        <CardDescription>
          {inventoryTrend.location
            ? `Location: ${inventoryTrend.location}`
            : "All Locations"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ChartContainer config={chartConfig} className="h-full w-full">
          <AreaChart
            accessibilityLayer
            data={inventoryTrend.points}
            margin={{ left: 12, right: 12 }}
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
                <stop
                  offset="5%"
                  stopColor="var(--color-on_hand)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-on_hand)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <Area
              dataKey="on_hand"
              type="natural"
              fill="url(#fillOnHand)"
              fillOpacity={0.4}
              stroke="var(--color-on_hand)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

export default SkuTrendChart
