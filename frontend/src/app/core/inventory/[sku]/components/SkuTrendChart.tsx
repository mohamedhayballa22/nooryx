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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { InventoryTrend } from "@/lib/api/inventory"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

interface SkuTrendChartProps {
  inventoryTrend: InventoryTrend
}

const SkuTrendChart: React.FC<SkuTrendChartProps> = ({ inventoryTrend }) => {
  const [range, setRange] = React.useState("Last Month")

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
          <CardDescription>
            {inventoryTrend.location
              ? `Location: ${inventoryTrend.location}`
              : inventoryTrend.locations === 1
              ? `Single Location view`
              : "All Locations"}
          </CardDescription>
        </div>

        {/* Dropdown on top-right */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="ml-auto cursor-pointer">
              {range}
              <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {["Last Week", "Last Month", "Last 6 Months", "Last Year"].map(
              (option) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => setRange(option)}
                  className={
                    range === option ? "font-medium text-primary" : undefined
                  }
                >
                  {option}
                </DropdownMenuItem>
              )
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="flex-1 min-h-0">
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
      </CardContent>
    </Card>
  )
}

export default SkuTrendChart
