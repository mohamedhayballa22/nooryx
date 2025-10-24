import { protectedApiClient } from "./protected-client";
import { InventoryTrend, LatestAuditTrailData } from "./inventory";

export interface DashboardSummary {
  first_name: string;
  low_stock: number;
  out_of_stock: number;
  fast_mover_low_stock_sku: string[] | null;
  fast_mover_out_of_stock_sku: string[] | null;
  inactive_sku_in_stock: string[] | null;
  empty_inventory: boolean;
  locations: string[];
}

export interface DashboardMetricsData {
  total_available: number;
  total_on_hand: {
    value: number;
    delta_pct: number;
  };
  stockouts: number;
  low_stock: number;
  location: string | null;
}

export interface TopSKUsItem {
  sku: string;
  sku_name: string;
  available: number;
  status: string;
}

export interface TopSKUsResponse {
  location: string | null;
  skus: TopSKUsItem[];
}

// Builds a query string based on the optional location filter.
function buildQuery(location?: string): string {
  return location ? `?location=${encodeURIComponent(location)}` : "";
}

// Builds a query string based on optional location and period filters.
function buildTopMoversQuery(location?: string, period?: string): string {
  const params = new URLSearchParams();
  
  if (location) {
    params.append("location", location);
  }
  
  if (period) {
    params.append("period", period);
  }
  
  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

// API Functions

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return protectedApiClient<DashboardSummary>('/reports/summary');
}

export async function getDashboardMetrics(
  location?: string
): Promise<DashboardMetricsData> {
  return protectedApiClient<DashboardMetricsData>(`/reports/metrics${buildQuery(location)}`);
}

export async function getDashLatestTransactions(
  location?: string
): Promise<LatestAuditTrailData> {
  return protectedApiClient<LatestAuditTrailData>(`/transactions/latest${buildQuery(location)}`);
}

export async function getTopMovers(
  location?: string,
  period: string = "7d"
): Promise<TopSKUsResponse> {
  return protectedApiClient<TopSKUsResponse>(
    `/reports/top-movers${buildTopMoversQuery(location, period)}`
  );
}

export async function getTopInactives(
  location?: string,
  period: string = "7d"
): Promise<TopSKUsResponse> {
  return protectedApiClient<TopSKUsResponse>(
    `/reports/top-inactives${buildTopMoversQuery(location, period)}`
  );
}

// Fetch inventory trend data. Optionally filtered by location.
export async function getDashInventoryTrend(
  period: string = "30d",
  location?: string
): Promise<InventoryTrend> {
  const params = new URLSearchParams({ period });
  if (location) params.append("location", location);
  return protectedApiClient<InventoryTrend>(`/reports/trend/inventory?${params.toString()}`);
}
