"use client"

import { useState, useMemo } from "react"
import { SkuSnapshotCards } from "@/app/core/inventory/[sku]/components/SkuSnapshotCards"
import TrendChart from "@/components/TrendChart"
import { LatestAuditTrail } from "@/components/LatestAuditTrail"
import SkuHeader from "@/app/core/inventory/[sku]/components/SkuHeader"
import { useSku } from "@/app/core/inventory/[sku]/hooks/useSku"
import { useSkuTransactions } from "@/app/core/inventory/[sku]/hooks/useSkuTransactions"
import { useSkuTrend } from "@/app/core/inventory/[sku]/hooks/useSkuTrend"
import SkuNotFound from "@/components/sku-not-found"

type PeriodKey = "7d" | "31d" | "180d" | "365d"

interface SkuMasterViewProps {
  skuCode: string
}

export function SkuMasterView({ skuCode }: SkuMasterViewProps) {
  const [selectedLocation, setSelectedLocation] = useState<string>("all")

  const [preferredPeriod, setPreferredPeriod] = useState<PeriodKey | null>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("sku-trend-period") as PeriodKey) || null
    }
    return null
  })

  const handlePeriodChange = (newPeriod: PeriodKey) => {
    setPreferredPeriod(newPeriod)
    localStorage.setItem("sku-trend-period", newPeriod)
  }

  const {
    data: skuData,
    isLoading: isSkuLoading,
    errorStatus: skuSnapshotStatus,
  } = useSku(skuCode, selectedLocation === "all" ? undefined : selectedLocation)

  const {
    data: trendData,
    isLoading: isTrendLoading,
    errorStatus: trendStatus,
  } = useSkuTrend(
    skuCode,
    selectedLocation === "all" ? undefined : selectedLocation,
    preferredPeriod ?? "365d"
  )

  const {
    data: transactionsData,
    isLoading: isTransactionsLoading,
    errorStatus: transactionsStatus,
  } = useSkuTransactions(skuCode, selectedLocation === "all" ? undefined : selectedLocation)

  const displayPeriod = useMemo<PeriodKey>(() => {
    if (!trendData?.oldest_data_point) return "31d"

    const oldest = new Date(trendData.oldest_data_point)
    const now = new Date()
    const daysDiff = Math.floor((now.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24))

    const validPeriods: Record<PeriodKey, boolean> = {
      "7d": daysDiff > 0,
      "31d": daysDiff > 7,
      "180d": daysDiff > 31,
      "365d": daysDiff > 180,
    }

    if (preferredPeriod && validPeriods[preferredPeriod]) {
      return preferredPeriod
    }

    const widest = (["365d", "180d", "31d", "7d"] as PeriodKey[]).find(
      (k) => validPeriods[k]
    ) || "7d"
    
    return widest
  }, [trendData, preferredPeriod])
  
  const isUnauthorized = 
    skuSnapshotStatus === 404 || 
    trendStatus === 404 || 
    transactionsStatus === 404

  if (isUnauthorized) {
    return <SkuNotFound sku={skuCode} />
  }
  
  return (
    <main className="grid gap-5">
      {isSkuLoading ? (
        <SkuHeader.Skeleton />
      ) : skuData ? (
        <SkuHeader
          data={skuData}
          selectedLocation={selectedLocation}
          onTabChange={setSelectedLocation}
        />
      ) : null}

      {isSkuLoading ? (
        <SkuSnapshotCards.Skeleton />
      ) : skuData ? (
        <SkuSnapshotCards data={skuData} />
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-6 gap-5 auto-rows-[minmax(300px,480px)]">
        <div className="lg:col-span-4">
          {isTrendLoading ? (
            <TrendChart.Skeleton />
          ) : trendData ? (
            <TrendChart
              inventoryTrend={trendData}
              period={displayPeriod}
              onPeriodChange={handlePeriodChange}
            />
          ) : null}
        </div>

        <div className="lg:col-span-2">
          {isTransactionsLoading ? (
            <LatestAuditTrail.Skeleton />
          ) : transactionsData ? (
            <LatestAuditTrail {...transactionsData} />
          ) : null}
        </div>
      </div>
    </main>
  )
}
