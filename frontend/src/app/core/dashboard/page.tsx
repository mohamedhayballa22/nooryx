"use client"

import { useState, useMemo } from "react"
import { DashboardMetrics } from "./components/DashboardMetrics"
import { TopSKUsCard } from "./components/TopSKUsCard"
import DashboardHeader from "./components/DashboardHeader"
import { LatestAuditTrail } from "@/components/LatestAuditTrail"
import TrendChart from "@/components/TrendChart"

import { useDashboardSummary } from "./hooks/useDashboardSummary"
import { useDashbaordMetrics } from "./hooks/useDashboardMetrics"
import { useDashLatestTransactions } from "./hooks/useDashLatestTransactions"
import { useTopMovers } from "./hooks/useTopMovers"
import { useTopInactives } from "./hooks/useTopInactives"
import { useDashInventoryTrend } from "./hooks/useDashTrend"

type PeriodKey = "7d" | "31d" | "180d" | "365d"

// Add selected location as a URL param and reflect in breadcrumbs
export default function DashboardPage() {
  const [selectedLocation, setselectedLocation] = useState("all")

  // Each section manages its own period
  const [moversPeriod, setMoversPeriod] = useState<PeriodKey>("31d")
  const [inactivesPeriod, setInactivesPeriod] = useState<PeriodKey>("31d")
  const [trendPeriod, setTrendPeriod] = useState<PeriodKey | null>(() => {
      if (typeof window !== "undefined") {
        return (localStorage.getItem("dashboard-trend-period") as PeriodKey) || null
      }
      return null
    })

  // Memoize location parameter to avoid creating new values on every render
  const locationParam = useMemo(
    () => (selectedLocation === "all" ? undefined : selectedLocation),
    [selectedLocation]
  )

  const handlePeriodChange = (newPeriod: PeriodKey) => {
    setTrendPeriod(newPeriod)
    try {
      localStorage.setItem("dashboard-trend-period", newPeriod)
    } catch (error) {
      // localStorage unavailable, continue without persistence
    }
  }

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
  } = useDashboardSummary()

  const {
    data: metricsData,
    isLoading: isMetricsLoading,
  } = useDashbaordMetrics(locationParam)

  const {
    data: transactionsData,
    isLoading: isTransactionsLoading,
  } = useDashLatestTransactions(locationParam)

  const {
    data: topMoversData,
    isLoading: isTopMoversLoading,
  } = useTopMovers(locationParam, moversPeriod)

  const {
    data: topInactivesData,
    isLoading: isTopInactivesLoading,
  } = useTopInactives(locationParam, inactivesPeriod)

  const {
    data: trendData,
    isLoading: isTrendLoading,
  } = useDashInventoryTrend(locationParam, trendPeriod ?? "31d")

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
        <DashboardMetrics data={metricsData} />
      ) : null}

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-5">
        {/* Latest transactions */}
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
              period={inactivesPeriod}
              onPeriodChange={setInactivesPeriod}
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
              period={moversPeriod}
              onPeriodChange={setMoversPeriod}
            />
          ) : null}
        </div>
      </div>

      {/* Third row: Trend Chart */}
      <div className="w-full max-h-[480px]">
        {isTrendLoading ? (
          <TrendChart.Skeleton />
        ) : trendData ? (
          <TrendChart
            inventoryTrend={trendData}
            period={trendPeriod ?? "31d"}
            onPeriodChange={handlePeriodChange}
          />
        ) : null}
      </div>
    </div>
  )
}
