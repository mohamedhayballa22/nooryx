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
  total_value: number;
  currency: string;
  method: string;
  method_full_name: string;
  timestamp: string;
}

export interface COGSResponse {
  total_cogs: number;
  currency: string;
  timestamp: string;
  delta_percentage?: number;
  sku_code?: string;
  period_start?: string;
  period_end?: string;
}

export interface COGSResponse {
  total_cogs: number;
  currency: string;
  timestamp: string;
  delta_percentage?: number;
  sku_code?: string;
  period_start?: string;
  period_end?: string;
}

export interface SKUValuationParams {
  page?: number;
  size?: number;
}

export interface COGSParams {
  start_date?: string;
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

export async function getCOGS(params?: COGSParams): Promise<COGSResponse> {
  const queryParams = new URLSearchParams();
  if (params?.start_date) {
    queryParams.append('start_date', params.start_date);
  }
  
  const url = `/valuation/cogs${queryParams.toString() ? `?${queryParams}` : ''}`;
  return protectedApiClient<COGSResponse>(url);
}
