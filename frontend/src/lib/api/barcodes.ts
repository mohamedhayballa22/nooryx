import { protectedApiClient } from "./protected-client";

// Types
export interface BarcodeLookupResult {
  code: string;
  name: string;
  alerts: boolean;
  low_stock_threshold: number;
  reorder_point: number;
}

export interface LinkBarcodePayload {
  sku_code: string;
  barcode_value: string;
  barcode_format?: string;
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

export async function linkBarcode(payload: LinkBarcodePayload): Promise<void> {
  await protectedApiClient("/barcodes/link", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}