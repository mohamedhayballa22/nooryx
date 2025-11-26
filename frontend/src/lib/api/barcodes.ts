import { protectedApiClient } from "./protected-client";

// Types
export interface BarcodeLookupResult {
  code: string;
  name: string;
  alerts: boolean;
  low_stock_threshold: number;
  reorder_point: number;
}

// API Functions
export async function lookupBarcode(
  value: string
): Promise<BarcodeLookupResult | null> {
  const searchParams = new URLSearchParams({ value });
  return protectedApiClient<BarcodeLookupResult | null>(
    `/barcodes/lookup?${searchParams.toString()}`
  );
}
