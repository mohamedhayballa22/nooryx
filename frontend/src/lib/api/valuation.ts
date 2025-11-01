import { protectedApiClient } from "./protected-client";

// Types
export interface SKUValuation {
  sku_code: string;
  name: string;
  total_qty: number;
  avg_cost: string;
  total_value: string;
  currency: string;
}

export interface SKUValuationResponse {
  items: SKUValuation[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface TotalValuation {
  total_value: string;
  currency: string;
  method: string;
  method_full_name: string;
  timestamp: string;
  locale: string;
}

export interface SKUValuationParams {
  page?: number;
  size?: number;
}

// API Functions
export async function getSKUValuations(
  params?: SKUValuationParams
): Promise<SKUValuationResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page !== undefined) {
    queryParams.append('page', params.page.toString());
  }
  if (params?.size !== undefined) {
    queryParams.append('size', params.size.toString());
  }
  
  const url = `/valuation/skus${queryParams.toString() ? `?${queryParams}` : ''}`;
  return protectedApiClient<SKUValuationResponse>(url);
}

export async function getTotalValuation(): Promise<TotalValuation> {
  return protectedApiClient<TotalValuation>("/valuation");
}
