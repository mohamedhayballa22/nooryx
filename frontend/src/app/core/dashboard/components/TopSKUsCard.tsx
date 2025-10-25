"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, Check } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface TopSKUsItem {
  sku: string
  sku_name: string
  available: number
  status: string
}

interface TopSKUsResponse {
  location: string | null
  skus: TopSKUsItem[]
}

type PeriodKey = "7d" | "31d" | "180d" | "365d"

interface TopSKUsCardProps {
  title: string
  description?: string
  data: TopSKUsResponse
  period?: PeriodKey
  onPeriodChange?: (period: PeriodKey) => void
  variant?: "movers" | "inactives"
}

const TOTAL_ROWS = 5

export function TopSKUsCard({
  title,
  description,
  data,
  period: controlledPeriod,
  onPeriodChange,
  variant = "movers",
}: TopSKUsCardProps) {
  const [uncontrolledPeriod, setUncontrolledPeriod] = useState<PeriodKey>("31d")

  // Use controlled prop if provided; otherwise, fallback to internal state
  const period = controlledPeriod ?? uncontrolledPeriod

  const labelMaps = {
    movers: {
      "7d": "Last Week",
      "31d": "Last Month",
      "180d": "Last 6 Months",
      "365d": "Last Year",
    },
    inactives: {
      "7d": "Inactive 7+ days",
      "31d": "Inactive 30+ days",
      "180d": "Inactive 6+ months",
      "365d": "Inactive 1+ year",
    },
  }

  const periodLabelMap = labelMaps[variant]

  const handlePeriodChange = (newPeriod: PeriodKey) => {
    if (controlledPeriod === undefined) {
      setUncontrolledPeriod(newPeriod)
    }
    onPeriodChange?.(newPeriod)
  }

  // Utility for bar scaling
  const getLogPercentage = (value: number, maxValue: number): number => {
    if (value === 0 || maxValue === 0) return 0
    const logValue = Math.log10(value + 1)
    const logMax = Math.log10(maxValue + 1)
    return (logValue / logMax) * 100
  }

  // Get bar color based on status
  const getBarColor = (status: string): string => {
    switch (status) {
      case "Out of Stock":
        return "bg-red-500"
      case "Low Stock":
        return "bg-yellow-500"
      case "In Stock":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const maxAvailable = Math.max(...data.skus.map(sku => sku.available), 1)

  // Pad data to always show 5 rows
  const paddedData = [
    ...data.skus.slice(0, TOTAL_ROWS),
    ...Array(Math.max(0, TOTAL_ROWS - data.skus.length)).fill(null),
  ]

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>{title}</CardTitle>
          {(data.location || description) && (
            <CardDescription className="mt-1.5">
              {data.location ?? description}
            </CardDescription>
          )}
        </div>

        {/* Period Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="cursor-pointer">
              {periodLabelMap[period]}
              <ChevronDown className="ml-2 h-4 w-4 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.entries(periodLabelMap) as [PeriodKey, string][]).map(([key, label]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => handlePeriodChange(key)}
                className={cn(
                  "flex items-center justify-between gap-2",
                  period === key && "bg-accent"
                )}
              >
                <span>{label}</span>
                {period === key && <Check className="h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent>
        {paddedData.length > 0 ? (
          <div className="space-y-2">
            {paddedData.map((sku, index) => {
              const isEmptyState = sku === null

              if (isEmptyState) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="flex items-center gap-4 px-4 py-3 rounded-lg border border-dashed border-muted/30 bg-muted/2"
                  >
                    {/* Rank */}
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-muted-foreground/50">
                        {index + 1}
                      </span>
                    </div>

                    {/* Empty State Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-muted-foreground/50 truncate">—</p>
                      <p className="text-xs text-muted-foreground/30">—</p>
                    </div>

                    {/* Empty Stock Bar */}
                    <div className="flex-shrink-0 w-20">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden" />
                    </div>

                    {/* Empty Available Count */}
                    <div className="flex-shrink-0 text-right min-w-[60px]">
                      <p className="text-lg font-bold text-muted-foreground/50">—</p>
                      <p className="text-[10px] uppercase text-muted-foreground/30">
                        Available
                      </p>
                    </div>
                  </div>
                )
              }

              const percentage = getLogPercentage(sku.available, maxAvailable)

              return (
                <Link
                  key={sku.sku}
                  href={`/core/inventory/?sku=${sku.sku}`}
                  className="flex items-center gap-4 px-4 py-3 rounded-lg border border-muted/20 bg-muted/5 hover:bg-muted/15 hover:border-muted/40 hover:shadow-sm transition-all cursor-pointer group"
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{index + 1}</span>
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{sku.sku}</p>
                    <p className="text-xs text-muted-foreground">{sku.sku_name}</p>
                  </div>

                  {/* Stock Bar */}
                  <div className="flex-shrink-0 w-20">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all",
                          getBarColor(sku.status)
                        )}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Available Count */}
                  <div className="flex-shrink-0 text-right min-w-[60px]">
                    <p
                      className={cn(
                        "text-lg font-bold tabular-nums",
                        sku.status === "Out of Stock" && "text-red-500"
                      )}
                    >
                      {sku.available}
                    </p>
                    <p
                      className={cn(
                        "text-[10px] uppercase",
                        sku.status === "Out of Stock"
                          ? "text-red-500 font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      Available
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No inventory data available.</p>
        )}
      </CardContent>
    </Card>
  )
}

TopSKUsCard.Skeleton = function TopSKUsCardSkeleton() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>

        <Skeleton className="h-9 w-28" />
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {Array.from({ length: TOTAL_ROWS }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-4 px-4 py-3 rounded-lg border border-muted/20 bg-muted/5"
            >
              {/* Rank */}
              <Skeleton className="flex-shrink-0 w-8 h-8 rounded-full" />

              {/* Product Info */}
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-32" />
              </div>

              {/* Stock Bar */}
              <div className="flex-shrink-0 w-20">
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>

              {/* Available Count */}
              <div className="flex-shrink-0 text-right min-w-[60px] space-y-1">
                <Skeleton className="h-5 w-12 ml-auto" />
                <Skeleton className="h-2.5 w-14 ml-auto" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
