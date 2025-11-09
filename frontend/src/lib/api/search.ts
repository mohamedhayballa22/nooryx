import { protectedApiClient } from "./protected-client";

// Types
export interface SKUSearchResult {
  sku_code: string;
  sku_name: string;
  alerts_enabled: boolean;
  reorder_point: number;
  low_stock_threshold: number;
}

// API Functions
export async function searchSKUs(q: string): Promise<SKUSearchResult[]> {
  const searchParams = new URLSearchParams({ q });
  return protectedApiClient<SKUSearchResult[]>(
    `/search/skus?${searchParams.toString()}`
  );
}

export async function searchLocations(q: string): Promise<string[]> {
  const searchParams = new URLSearchParams({ q });
  return protectedApiClient<string[]>(
    `/search/locations?${searchParams.toString()}`
  );
}
