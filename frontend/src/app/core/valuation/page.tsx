"use client"

import { useState } from "react"
import { ValuationHeader } from "./components/valuation-header"
import { COGSHeader } from "./components/cogs"
import { ValuationDataTable } from "./components/valuation-skus-table"
import { PaginationState } from "@tanstack/react-table"
import { useSKUValuations } from "./hooks/use-sku-valuations"
import { useTotalValuation } from "./hooks/use-total-valuation"
import { useCOGS } from "./hooks/use-cogs"
import { useUserSettings } from "@/hooks/use-user-settings"
import { subMonths, startOfDay } from "date-fns"

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

  // Add state for selected period
  const [selectedPeriod, setSelectedPeriod] = useState<string>("last_month")

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
  } = useCOGS(
    selectedPeriod === "all_time"
      ? undefined
      : { start_date: cogsStartDate }
  );
  
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
    <div className="space-y-8">
      {/* Top Row: Valuation and COGS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Valuation Card */}
        <div>
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
        <div>
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

      {/* SKU Table */}
      <div>
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
