"use client"

import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import type { InventorySnapshot } from "@/lib/api/inventory"

interface Props {
  data: InventorySnapshot
  selectedTab: string
  onTabChange: (tab: string) => void
}

export default function SkuHeader({ data, selectedTab, onTabChange }: Props) {
  const { sku, product_name, status, locations, location_names } = data

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{sku}</h1>
          <p className="text-sm text-muted-foreground">{product_name}</p>
        </div>
        <Badge
          className={cn(
            "px-3 text-md font-medium",
            status === "In Stock" &&
              "border-transparent bg-green-100 text-green-800 hover:bg-green-100/80 dark:bg-green-900/50 dark:text-green-300",
            status === "Low Stock" &&
              "border-transparent bg-orange-100 text-yellow-800 hover:bg-yellow-100/80 dark:bg-yellow-900/50 dark:text-yellow-300",
            status === "Out of Stock" &&
              "border-transparent bg-red-100 text-red-800 hover:bg-red-100/80 dark:bg-red-900/50 dark:text-red-300"
          )}
        >
          {status}
        </Badge>
      </div>

      {locations > 1 && (
        <Tabs
          value={selectedTab}
          onValueChange={onTabChange}
          className="w-full"
        >
          <TabsList className="flex flex-wrap gap-2 bg-transparent border-b border-border p-0">
            <TabsTrigger
              value="all"
              className="px-3 py-2 text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary"
            >
              All Locations
            </TabsTrigger>

            {location_names.map((loc) => (
              <TabsTrigger
                key={loc}
                value={loc}
                className="px-3 py-2 text-sm rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary"
              >
                {loc}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
    </div>
  )
}

SkuHeader.Skeleton = function SkuHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* SKU + Product name */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Tabs (simulated) */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-1">
        <Skeleton className="h-7 w-24 rounded-none" />
        <Skeleton className="h-7 w-20 rounded-none" />
        <Skeleton className="h-7 w-20 rounded-none" />
      </div>
    </div>
  )
}
