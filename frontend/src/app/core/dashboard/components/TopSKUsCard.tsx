"use client"

import React, { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { NavArrowDown, Check } from "iconoir-react"
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

export const TopSKUsCard = React.memo(function TopSKUsCard({
  title,
  description,
  data,
  period: controlledPeriod,
  onPeriodChange,
  variant = "movers",
}: TopSKUsCardProps) {
  const [uncontrolledPeriod, setUncontrolledPeriod] = useState<PeriodKey>("31d")

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

  const getLogPercentage = (value: number, maxValue: number): number => {
    if (value === 0 || maxValue === 0) return 0
    const logValue = Math.log10(value + 1)
    const logMax = Math.log10(maxValue + 1)
    return (logValue / logMax) * 100
  }

  const getBarColor = (status: string): string => {
    switch (status) {
      case "Out of Stock": return "bg-red-500"
      case "Low Stock": return "bg-yellow-500"
      case "In Stock": return "bg-green-500"
      default: return "bg-gray-500"
    }
  }

  const maxAvailable = Math.max(...data.skus.map(sku => sku.available), 1)

  const paddedData = [
    ...data.skus.slice(0, TOTAL_ROWS),
    ...Array(Math.max(0, TOTAL_ROWS - data.skus.length)).fill(null),
  ]

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-0">
        <div>
          <CardTitle className="leading-tight">{title}</CardTitle>
          {(data.location || description) && (
            <CardDescription className="mt-1.5">
              {data.location ?? description}
            </CardDescription>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full sm:w-auto justify-between sm:justify-center cursor-pointer">
              {periodLabelMap[period]}
              <NavArrowDown className="ml-2 h-4 w-4 opacity-60" />
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
                    className="flex items-center gap-3 px-3 py-3 sm:px-4 sm:gap-4 rounded-lg border border-dashed border-muted/30 bg-muted/2"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-muted-foreground/50">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-muted-foreground/50 truncate">—</p>
                      <p className="text-xs text-muted-foreground/30 hidden sm:block">—</p>
                    </div>
                    <div className="flex-shrink-0 w-15 hidden sm:block">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden" />
                    </div>
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
                  href={`/core/inventory?sku=${encodeURIComponent(sku.sku)}`}
                  className="group relative flex items-start sm:items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4 rounded-lg border border-muted/20 bg-muted/5 hover:bg-muted/15 hover:border-muted/40 hover:shadow-sm transition-all cursor-pointer"
                >
                  {/* Rank - Fixed Size */}
                  <div className="flex-shrink-0 w-8 h-8 mt-0.5 sm:mt-0 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-sm font-bold text-primary">{index + 1}</span>
                  </div>

                  {/* Product Info - Takes available space */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="font-medium text-foreground truncate text-sm sm:text-base">
                      {sku.sku}
                    </p>
                    <p className="text-xs text-muted-foreground truncate leading-tight">
                      {sku.sku_name}
                    </p>
                  </div>

                  <div className="flex-shrink-0 flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-4">

                    {/* Stock Bar */}
                    <div className="w-16 sm:w-20">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden w-full">
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
                    <div className="text-right min-w-[50px] sm:min-w-[60px]">
                      <p
                        className={cn(
                          "text-base sm:text-lg font-bold tabular-nums leading-none sm:leading-normal",
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
}) as React.NamedExoticComponent<TopSKUsCardProps> & {
  Skeleton: React.FC
}

TopSKUsCard.Skeleton = function TopSKUsCardSkeleton() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-0">
        <div>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-full sm:w-28" />
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          {Array.from({ length: TOTAL_ROWS }).map((_, index) => (
            <div
              key={index}
              className="flex items-start sm:items-center gap-3 px-3 py-3 sm:gap-4 sm:px-4 rounded-lg border border-muted/20 bg-muted/5"
            >
              <Skeleton className="flex-shrink-0 w-8 h-8 rounded-full" />

              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16 sm:w-32" />
              </div>

              <div className="flex-shrink-0 flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
                <Skeleton className="h-1.5 w-16 sm:w-20 rounded-full" />
                <div className="space-y-1 text-right">
                  <Skeleton className="h-5 w-10 ml-auto" />
                  <Skeleton className="h-2.5 w-12 ml-auto" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

