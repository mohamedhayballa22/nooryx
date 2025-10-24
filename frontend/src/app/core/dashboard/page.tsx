"use client"

import { useState } from "react"
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

export default function DashboardPage() {
  const [selectedLocation, setselectedLocation] = useState("all")

  // Each section manages its own period
  const [moversPeriod, setMoversPeriod] = useState<PeriodKey>("31d")
  const [inactivesPeriod, setInactivesPeriod] = useState<PeriodKey>("31d")
  const [trendPeriod, setTrendPeriod] = useState<PeriodKey>("365d")

  const {
    data: summaryData,
    isLoading: isSummaryLoading,
  } = useDashboardSummary()

  const {
    data: metricsData,
    isLoading: isMetricsLoading,
  } = useDashbaordMetrics(selectedLocation === "all" ? undefined : selectedLocation)

  const {
    data: transactionsData,
    isLoading: isTransactionsLoading,
  } = useDashLatestTransactions(selectedLocation === "all" ? undefined : selectedLocation)

  const {
    data: topMoversData,
    isLoading: isTopMoversLoading,
  } = useTopMovers(
    selectedLocation === "all" ? undefined : selectedLocation,
    moversPeriod
  )

  const {
    data: topInactivesData,
    isLoading: isTopInactivesLoading,
  } = useTopInactives(
    selectedLocation === "all" ? undefined : selectedLocation,
    inactivesPeriod
  )

  const {
    data: trendData,
    isLoading: isTrendLoading,
  } = useDashInventoryTrend(
    selectedLocation === "all" ? undefined : selectedLocation,
    trendPeriod
  )

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
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-5 auto-rows-[minmax(300px,480px)]">
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
            period={trendPeriod}
            onPeriodChange={setTrendPeriod}
          />
        ) : null}
      </div>
    </div>
  )
}
