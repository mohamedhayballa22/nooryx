"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { NavArrowDownSolid } from "iconoir-react"
import { ReceiveForm } from "@/components/forms/receive-form"
import { AdjustForm } from "@/components/forms/adjust-form"
import { ReserveForm } from "@/components/forms/reserve-form"
import { ShipForm } from "@/components/forms/ship-form"
import { UnreserveForm } from "@/components/forms/unreserve-form"
import { TransferForm } from "@/components/forms/transfer-form"
import { UpdateSkuForm } from "@/components/forms/updatesku/update-sku-form"
import type { InventorySnapshot } from "@/lib/api/inventory"
import React from "react"

interface Props {
  data: InventorySnapshot
  selectedLocation: string
  onTabChange: (tab: string) => void
}

export const SkuHeader = React.memo(function SkuHeader({ data, selectedLocation, onTabChange }: Props) {
  const { sku_code, name, alerts, low_stock_threshold, reorder_point, status, locations, location_names } = data
  const [isReceiveFormOpen, setIsReceiveFormOpen] = useState(false)
  const [activeForm, setActiveForm] = useState<string | null>(null)

  const skuContext = {
    sku_code: sku_code,
    sku_name: name,
    alerts: alerts,
    low_stock_threshold: low_stock_threshold,
    reorder_point: reorder_point,
  }

  const locationContext = location_names.length === 1 ? { location: location_names[0] } : undefined

  return (
    <>
      <div className="flex flex-col gap-4 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">{sku_code}</h1>

              <Badge
                className={cn(
                  "px-3 text-md font-medium",
                  status === "In Stock" &&
                    "border-transparent bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300",
                  status === "Low Stock" &&
                    "border-transparent bg-orange-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
                  status === "Out of Stock" &&
                    "border-transparent bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                )}
              >
                {status}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground">{name}</p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-stretch border rounded-md overflow-hidden">
              <Button 
                variant="ghost"
                className="rounded-none border-0 hover:bg-accent"
                onClick={() => setIsReceiveFormOpen(true)}
              >
                Receive Stock
              </Button>
              <div className="w-px bg-border" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost"
                    className="rounded-none border-0 h-full px-3 hover:bg-accent"
                    aria-label="More actions"
                  >
                    <NavArrowDownSolid className="h-4 w-4 mt-0.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setActiveForm("ship")}>
                    Ship
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveForm("reserve")}>
                    Reserve
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveForm("unreserve")}>
                    Unreserve
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveForm("transfer")}>
                    Transfer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActiveForm("adjust")}>
                    Adjust
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => setActiveForm("update-sku")}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {locations > 1 && (
          <Tabs
            value={selectedLocation}
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

      {/* Forms */}
      <UpdateSkuForm
        open={activeForm === "update-sku"}
        onOpenChange={(open) => !open && setActiveForm(null)}
        skuContext={skuContext}
      />
      <ReceiveForm
        open={isReceiveFormOpen || activeForm === "receive"}
        onOpenChange={(open) => !open && (setIsReceiveFormOpen(false), setActiveForm(null))}
        invalidateQueries={["inventory", "transactions", "trend", "valuation", "search", "skus"]}
        skuContext={skuContext}
        locationContext={locationContext}
      />
      <ShipForm
        open={activeForm === "ship"}
        onOpenChange={(open) => !open && setActiveForm(null)}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
        skuContext={skuContext}
        locationContext={locationContext}
      />
      <ReserveForm
        open={activeForm === "reserve"}
        onOpenChange={(open) => !open && setActiveForm(null)}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
        skuContext={skuContext}
        locationContext={locationContext}
      />
      <UnreserveForm
        open={activeForm === "unreserve"}
        onOpenChange={(open) => !open && setActiveForm(null)}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
        skuContext={skuContext}
        locationContext={locationContext}
      />
      <TransferForm
        open={activeForm === "transfer"}
        onOpenChange={(open) => !open && setActiveForm(null)}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
        skuContext={skuContext}
        locationContext={locationContext}
      />
      <AdjustForm
        open={activeForm === "adjust"}
        onOpenChange={(open) => !open && setActiveForm(null)}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
        skuContext={skuContext}
        locationContext={locationContext}
      />
    </>
  )
}) as React.NamedExoticComponent<Props> & {
  Skeleton: React.FC
}

SkuHeader.Skeleton = function SkuHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-4 pb-4">
      {/* SKU Code + Name + Badge + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-10 w-36" />
          <Skeleton className="h-10 w-10" />
        </div>
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
