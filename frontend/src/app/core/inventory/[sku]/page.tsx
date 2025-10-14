"use client"

import { useState, useMemo } from "react"
import { useParams } from "next/navigation"
import { SkuSnapshotCards } from "./components/SkuSnapshotCards"
import TrendChart from "@/components/TrendChart"
import { LatestAuditTrail } from "@/components/LatestAuditTrail"
import SkuHeader from "./components/SkuHeader"
import { useSku } from "./hooks/useSku"
import { useSkuTransactions } from "./hooks/useSkuTransactions"
import { useSkuTrend } from "./hooks/useSkuTrend"
import SkuNotFound from "@/components/sku-not-found";

type PeriodKey = "7d" | "31d" | "180d" | "365d"

export default function Page() {
  const params = useParams()
  const sku = Array.isArray(params.sku) ? params.sku[0] : (params.sku as string)

  // Selected Location State (no longer persistent)
  const [selectedLocation, setSelectedLocation] = useState<string>("all")

  // Period State with preference vs display separation (still persistent)
  const [preferredPeriod, setPreferredPeriod] = useState<PeriodKey | null>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("sku-trend-period") as PeriodKey) || null
    }
    return null
  })

  // Update localStorage only when user explicitly changes preference
  const handlePeriodChange = (newPeriod: PeriodKey) => {
    setPreferredPeriod(newPeriod)
    localStorage.setItem("sku-trend-period", newPeriod)
  }

  // Data fetching with location + period awareness
  const {
    data: skuData,
    isLoading: isSkuLoading,
    errorStatus: skuSnapshotStatus,
  } = useSku(sku, selectedLocation === "all" ? undefined : selectedLocation)

  const {
    data: trendData,
    isLoading: isTrendLoading,
    errorStatus: trendStatus,
  } = useSkuTrend(
    sku,
    selectedLocation === "all" ? undefined : selectedLocation,
    preferredPeriod ?? "365d"
  )

  const {
    data: transactionsData,
    isLoading: isTransactionsLoading,
    errorStatus: transactionsStatus,
  } = useSkuTransactions(sku, selectedLocation === "all" ? undefined : selectedLocation)

  // Calculate the actual displayable period (falls back if preferred isn't available)
  const displayPeriod = useMemo<PeriodKey>(() => {
    if (!trendData?.oldest_data_point) return "31d" // Fallback while loading

    const oldest = new Date(trendData.oldest_data_point)
    const now = new Date()
    const daysDiff = Math.floor((now.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24))

    const validPeriods: Record<PeriodKey, boolean> = {
      "7d": daysDiff > 0,
      "31d": daysDiff > 7,
      "180d": daysDiff > 31,
      "365d": daysDiff > 180,
    }

    // If user has a preference and it's valid, use it
    if (preferredPeriod && validPeriods[preferredPeriod]) {
      return preferredPeriod
    }

    // Otherwise, use the widest valid period (for new users or when preference isn't valid)
    const widest = (["365d", "180d", "31d", "7d"] as PeriodKey[]).find(
      (k) => validPeriods[k]
    ) || "7d"
    
    return widest
  }, [trendData, preferredPeriod])
  
  const isUnauthorized = 
    skuSnapshotStatus === 404 || 
    trendStatus === 404 || 
    transactionsStatus === 404;

  if (isUnauthorized) {
    return <SkuNotFound sku={sku} />;
  }
  
  return (
    <main className="grid gap-5">
      {/* SKU Header */}
      {isSkuLoading ? (
        <SkuHeader.Skeleton />
      ) : skuData ? (
        <SkuHeader
          data={skuData}
          selectedTab={selectedLocation}
          onTabChange={setSelectedLocation}
        />
      ) : null}

      {/* Snapshot Cards */}
      {isSkuLoading ? (
        <SkuSnapshotCards.Skeleton />
      ) : skuData ? (
        <SkuSnapshotCards data={skuData} />
      ) : null}

      {/* Trend + Audit Trail Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-5 auto-rows-[minmax(300px,480px)]">
        {/* Trend Chart */}
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

        {/* Audit Trail */}
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
