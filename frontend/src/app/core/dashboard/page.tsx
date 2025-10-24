"use client"

import { DashboardMetrics } from "./components/DashboardMetrics"
import { TopSKUsCard } from "./components/TopSKUsCard"
import DashboardHeader from "./components/DashboardHeader"
import { useEffect, useMemo, useState } from "react"
import { LatestAuditTrail } from "@/components/LatestAuditTrail"
import TrendChart from "@/components/TrendChart"
import { useDashboardSummary } from "./hooks/useDashboardSummary"
import { useDashbaordMetrics } from "./hooks/useDashboardMetrics"
import { useDashLatestTransactions } from "./hooks/useDashLatestTransactions"
import { useTopMovers } from "./hooks/useTopMovers"
import { useTopInactives } from "./hooks/useTopInactives"
import { useDashInventoryTrend } from "./hooks/useDashTrend"


type PeriodKey = "7d" | "31d" | "180d" | "365d"


export default function DashboardPage() {
  const [selectedLocation, setselectedLocation] = useState("all")
  const [preferredPeriod, setPreferredPeriod] = useState<PeriodKey | null>(null)

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    errorStatus: summaryErrorStatus,
  } = useDashboardSummary();

  const {
    data: metricsData,
    isLoading: isMetricsLoading,
    errorStatus: metricsErrorStatus,
    hasData,
  } = useDashbaordMetrics(selectedLocation === "all" ? undefined : selectedLocation);

  const {
    data: transactionsData,
    isLoading: isTransactionsLoading,
    errorStatus: transactionsErrorStatus,
    hasTransactions,
  } = useDashLatestTransactions(selectedLocation === "all" ? undefined : selectedLocation);

  const {
    data: topMoversData,
    isLoading: isTopMoversLoading,
    errorStatus: topMoversErrorStatus,
  } = useTopMovers(
    selectedLocation === "all" ? undefined : selectedLocation);

  const {
    data: topInactivesData,
    isLoading: isTopInactivesLoading,
    errorStatus: topInactivesErrorStatus,
  } = useTopInactives(
    selectedLocation === "all" ? undefined : selectedLocation);

  const {
    data: trendData,
    isLoading: isTrendLoading,
    errorStatus: trendStatus,
  } = useDashInventoryTrend(
    selectedLocation === "all" ? undefined : selectedLocation,
    preferredPeriod ?? "365d"
  )
  



  useEffect(() => {
    const stored = localStorage.getItem("dashboard-trend-period") as PeriodKey | null
    if (stored) {
      setPreferredPeriod(stored)
    }
  }, [])
    
  const handlePeriodChange = (newPeriod: PeriodKey) => {
      setPreferredPeriod(newPeriod)
      localStorage.setItem("dashboard-trend-period", newPeriod)
    }

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

  return (
    <div className="grid gap-5">
      {isSummaryLoading ? (
        <DashboardHeader.Skeleton />
      ) : summaryData ? (
        <DashboardHeader
          data={summaryData}
          selectedLocation={selectedLocation}
          onTabChange={setselectedLocation}
        />
      ) : null}

      {/* Top row */}
      {isMetricsLoading ? (
        <DashboardMetrics.Skeleton />
      ) : metricsData ? (
        <DashboardMetrics
          data={metricsData}
        />
      ) : null}

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-5 auto-rows-[minmax(300px,480px)]">
        {/* Active Locations */}
        <div className="lg:col-span-2">
          {isTransactionsLoading ? (
            <LatestAuditTrail.Skeleton />
          ) : transactionsData ? (
            <LatestAuditTrail {...transactionsData} />
          ) : null}
        </div>

        {/* Inactive Stock */}
        <div className="lg:col-span-2">
          {isTopInactivesLoading ? (
            <TopSKUsCard.Skeleton />
          ) : topInactivesData ? (
            <TopSKUsCard
              title="Inactive Stock"
              description="SKUs with no outbound activity"
              data={topInactivesData}
              variant="inactives"
            />
          ) : null}
        </div>
        {/* Fast Movers */}
        <div className="lg:col-span-2">
          {isTopMoversLoading ? (
            <TopSKUsCard.Skeleton />
          ) : topMoversData ? (
            <TopSKUsCard
              title="Top Fast Movers"
              description="SKUs with the highest outbound movement"
              data={topMoversData}
              variant="movers"
            />
          ) : null}
        </div>
      </div>

      {/* Third row */}
      <div className="w-full max-h-[480px]">
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
    </div>
  )
}