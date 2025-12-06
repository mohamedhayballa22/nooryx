"use client"

import { useState } from "react"
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
import { subMonths, startOfDay } from "date-fns"

type PeriodKey = "7d" | "30d" | "90d" | "180d"
type GranularityKey = "daily" | "weekly" | "monthly"

export default function Page() {
  const { settings } = useUserSettings()
  const defaultPageSize = settings?.pagination || 10

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  })

  const initialStartDate = startOfDay(subMonths(new Date(), 1)).toISOString()
  
  const [cogsStartDate, setCogsStartDate] = useState<string>(
    initialStartDate
  )

  // State for COGS header period
  const [selectedPeriod, setSelectedPeriod] = useState<string>("last_month")

  // State for COGS trend chart
  const [trendPeriod, setTrendPeriod] = useState<PeriodKey>("30d")
  const [trendGranularity, setTrendGranularity] = useState<GranularityKey>("daily")

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

  const {
    data: cogsTrendData,
    isLoading: isLoadingCOGSTrend,
  } = useCOGSTrend({
    granularity: trendGranularity,
    period: trendGranularity === "daily" ? trendPeriod : undefined,
  })
  
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
    if (period === "all_time") {
      setCogsStartDate(undefined as any)
    } else {
      setCogsStartDate(startDate)
    }
    setSelectedPeriod(period)
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
              period={trendPeriod}
              granularity={trendGranularity}
              onPeriodChange={setTrendPeriod}
              onGranularityChange={setTrendGranularity}
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
