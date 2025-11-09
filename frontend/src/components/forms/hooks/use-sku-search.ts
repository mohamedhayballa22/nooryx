import { useQuery } from "@tanstack/react-query";
import { searchSKUs, SKUSearchResult } from "@/lib/api/search";
import { ApiError } from "@/lib/api/client";
import { Option } from "../searchable-autocomplete";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useSkuSearch(query: string) {
  const queryResult = useQuery({
    queryKey: ["search", "skus", query],
    queryFn: () => searchSKUs(query),
    enabled: !!query,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: false,
    select: (data: SKUSearchResult[]): Option[] =>
      data.map((sku) => ({
        value: sku.sku_code,
        label: sku.sku_code,
        metadata: {
          sku_name: sku.sku_name,
          ...(sku.alerts_enabled !== undefined && { alerts_enabled: sku.alerts_enabled }),
          ...(sku.reorder_point !== undefined && { reorder_point: sku.reorder_point }),
          ...(sku.low_stock_threshold !== undefined && { low_stock_threshold: sku.low_stock_threshold }),
        },
      })),
  });

  const hasData = !!queryResult.data;
  const errorStatus = getErrorStatus(queryResult.error);

  return {
    ...queryResult,
    data: queryResult.data ?? [],
    hasData,
    errorStatus,
  };
}
