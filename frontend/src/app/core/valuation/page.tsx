"use client"

import { useState } from "react"
import { ValuationHeader } from "./components/valuation-header"
import { ValuationDataTable } from "./components/valuation-skus-table"
import { PaginationState } from "@tanstack/react-table"
import { useSKUValuations } from "./hooks/use-sku-valuations"
import { useTotalValuation } from "./hooks/use-total-valuation"

export default function Page() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const { data: headerData, isLoading: isLoadingHeader, refetch: refetchHeader, isRefetching: isRefetchingHeader} = useTotalValuation()
  const { data: tableData, isLoading: isLoadingTable } = useSKUValuations(
    pagination.pageIndex,
    pagination.pageSize
  )

  const handleRefresh = async () => {
    await refetchHeader()
  }

  return (
    <div className="space-y-8">
      {isLoadingHeader ? (
        <ValuationHeader.Skeleton />
      ) : (
        headerData && (
          <ValuationHeader 
            {...headerData} 
            onRefresh={handleRefresh}
            isRefreshing={isRefetchingHeader}
          />
        )
      )}
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
