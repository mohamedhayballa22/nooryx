import { useQuery } from "@tanstack/react-query";
import { lookupBarcode } from "@/lib/api/barcodes";
import { ApiError } from "@/lib/api/client";

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.status;
  }
  return undefined;
}

export function useBarcodeLookup(barcodeValue: string) {
  const queryResult = useQuery({
    queryKey: ["barcode", "lookup", barcodeValue],
    queryFn: () => lookupBarcode(barcodeValue),
    enabled: !!barcodeValue,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });

  const hasData = queryResult.data !== null && queryResult.data !== undefined;
  const errorStatus = getErrorStatus(queryResult.error);
  const notFound = !queryResult.isLoading && queryResult.data === null;

  return {
    ...queryResult,
    hasData,
    errorStatus,
    notFound,
    sku: queryResult.data,
  };
}
