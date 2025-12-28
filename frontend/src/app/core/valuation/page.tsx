"use client"

import { useState, useMemo } from "react"
import { ValuationHeader } from "./components/valuation-header"
import { COGSHeader } from "./components/cogs"
import COGSTrendChart from "./components/cogs-trend"
import { ValuationDataTable } from "./components/valuation-skus-table"
import { PaginationState } from "@tanstack/react-table"
import { useSKUValuations } from "./hooks/use-sku-valuations"
import { useTotalValuation } from "./hooks/use-total-valuation"
import { useCOGS } from "./hooks/use-cogs"
import { useCOGSTrend } from "./hooks/use-cogs-trend"
import { useUserSettings } from "@/hooks/use-user-settings"
import { subMonths, subYears, startOfDay } from "date-fns"

type PeriodKey = "7d" | "30d" | "90d" | "180d" | "1y"
type GranularityKey = "daily" | "weekly" | "monthly"

interface COGSTrendSettings {
  period: PeriodKey
  granularity: GranularityKey
}

type COGSPeriodKey = "last_month" | "last_3_months" | "last_6_months" | "last_year" | "all_time"

const COGS_PERIOD_START_DATES: Record<COGSPeriodKey, () => Date> = {
  last_month: () => subMonths(new Date(), 1),
  last_3_months: () => subMonths(new Date(), 3),
  last_6_months: () => subMonths(new Date(), 6),
  last_year: () => subYears(new Date(), 1),
  all_time: () => new Date(0),
}

export default function Page() {
  const { settings } = useUserSettings()
  const defaultPageSize = settings?.pagination || 10

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  })

  // State for COGS header period with localStorage persistence
  const [selectedPeriod, setSelectedPeriod] = useState<COGSPeriodKey>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("cogs-period-setting")
        if (stored) {
          const parsed = stored as COGSPeriodKey
          const validPeriods: COGSPeriodKey[] = [
            "last_month",
            "last_3_months",
            "last_6_months",
            "last_year",
            "all_time"
          ]
          
          if (validPeriods.includes(parsed)) {
            return parsed
          }
        }
      } catch (error) {
        // localStorage unavailable or invalid, use default
      }
    }
    return "last_month"
  })

  // Compute start date from selected period
  const cogsStartDate = useMemo(() => {
    if (selectedPeriod === "all_time") {
      return undefined
    }
    return startOfDay(COGS_PERIOD_START_DATES[selectedPeriod]()).toISOString()
  }, [selectedPeriod])

  // State for COGS trend chart with localStorage persistence
  const [trendSettings, setTrendSettings] = useState<COGSTrendSettings>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("cogs-trend-settings")
        if (stored) {
          const parsed = JSON.parse(stored) as COGSTrendSettings
          const validPeriods: PeriodKey[] = ["7d", "30d", "90d", "180d", "1y"]
          const validGranularities: GranularityKey[] = ["daily", "weekly", "monthly"]
          
          if (
            validPeriods.includes(parsed.period) &&
            validGranularities.includes(parsed.granularity)
          ) {
            return parsed
          }
        }
      } catch (error) {
        // localStorage unavailable or invalid JSON, use defaults
      }
    }
    return { period: "30d", granularity: "daily" }
  })

  const { 
    data: headerData, 
    isLoading: isLoadingHeader, 
    refetch: refetchHeader, 
    isRefetching: isRefetchingHeader 
  } = useTotalValuation()
  
  const {
    data: cogsData,
    isLoading: isLoadingCOGS,
    refetch: refetchCOGS,
    isRefetching: isRefetchingCOGS
  } = useCOGS(selectedPeriod, {
    start_date: cogsStartDate,
  })

  // Memoize query parameters to avoid recreating objects on every render
  const cogsTrendQueryParams = useMemo(() => ({
    granularity: trendSettings.granularity,
    period: trendSettings.granularity === "daily" ? trendSettings.period : undefined,
  }), [trendSettings.granularity, trendSettings.period])

  const {
    data: cogsTrendData,
    isLoading: isLoadingCOGSTrend,
  } = useCOGSTrend(cogsTrendQueryParams)
  
  const { data: tableData, isLoading: isLoadingTable } = useSKUValuations(
    pagination.pageIndex,
    pagination.pageSize
  )

  const handleRefreshValuation = async () => {
    await refetchHeader()
  }

  const handleRefreshCOGS = async () => {
    await refetchCOGS()
  }

  const handleCOGSPeriodChange = (startDate: string, period: string) => {
    const newPeriod = period as COGSPeriodKey
    setSelectedPeriod(newPeriod)
    
    try {
      localStorage.setItem("cogs-period-setting", newPeriod)
    } catch (error) {
      // localStorage unavailable, continue without persistence
    }
  }

  const handleTrendPeriodChange = (newPeriod: PeriodKey) => {
    const newSettings = { ...trendSettings, period: newPeriod }
    setTrendSettings(newSettings)
    try {
      localStorage.setItem("cogs-trend-settings", JSON.stringify(newSettings))
    } catch (error) {
      // localStorage unavailable, continue without persistence
    }
  }

  const handleTrendGranularityChange = (newGranularity: GranularityKey) => {
    const newSettings = { ...trendSettings, granularity: newGranularity }
    setTrendSettings(newSettings)
    try {
      localStorage.setItem("cogs-trend-settings", JSON.stringify(newSettings))
    } catch (error) {
      // localStorage unavailable, continue without persistence
    }
  }

  return (
    <div className="grid gap-5 w-full max-w-full">
      {/* Top Row: Valuation and COGS */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 w-full">
        {/* Valuation Card */}
        <div className="min-w-0">
          {isLoadingHeader ? (
            <ValuationHeader.Skeleton />
          ) : (
            headerData && (
              <ValuationHeader 
                {...headerData} 
                onRefresh={handleRefreshValuation}
                isRefreshing={isRefetchingHeader}
              />
            )
          )}
        </div>

        {/* COGS Card */}
        <div className="min-w-0">
          {isLoadingCOGS ? (
            <COGSHeader.Skeleton />
          ) : (
            cogsData && (
              <COGSHeader 
                {...cogsData} 
                selectedPeriod={selectedPeriod}
                onRefresh={handleRefreshCOGS}
                onPeriodChange={handleCOGSPeriodChange}
                isRefreshing={isRefetchingCOGS}
              />
            )
          )}
        </div>
      </div>

      {/* COGS Trend Chart */}
      <div className="w-full max-h-[480px] min-w-0">
        {isLoadingCOGSTrend ? (
          <COGSTrendChart.Skeleton />
        ) : (
          cogsTrendData && (
            <COGSTrendChart
              cogsTrend={cogsTrendData}
              period={trendSettings.period}
              granularity={trendSettings.granularity}
              onPeriodChange={handleTrendPeriodChange}
              onGranularityChange={handleTrendGranularityChange}
            />
          )
        )}
      </div>

      {/* SKU Table */}
      <div className="min-w-0">
        {isLoadingTable ? (
          <ValuationDataTable.Skeleton />
        ) : (
          tableData && (
            <ValuationDataTable
              data={tableData.items}
              pagination={pagination}
              onPaginationChange={setPagination}
              totalPages={tableData.pages}
              totalItems={tableData.total}
            />
          )
        )}
      </div>
    </div>
  )
}
