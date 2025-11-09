import { protectedApiClient } from "./protected-client";

// Types
export interface InventorySummary {
  available: number;
  reserved: number;
  on_hand: {
    value: number;
    delta_pct: number;
  };
}

export interface InventorySnapshot {
  sku_code: string;
  name: string;
  alerts: boolean;
  reorder_point: number;
  low_stock_threshold: number;
  status: string;
  location: string | null;
  locations: number;
  location_names: string[];
  inventory_pct: number
  summary: InventorySummary;
}

export interface InventoryTrendPoint {
  date: string;
  on_hand: number;
}

export interface InventoryTrend {
  sku_code?: string;
  location: string | null;
  oldest_data_point: string;
  points: InventoryTrendPoint[];
}

export interface TransactionItem {
  id: number;
  date: string;
  actor: string;
  action: string;
  quantity: number;
  sku_code: string;
  location: string;
  qty_before: number;
  qty_after: number;
  metadata?: {
    target_location?: string;
    source_location?: string;
    [key: string]: any;
  } | null;
}

export interface TransactionsResponse {
  items: TransactionItem[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface TransactionsParams {
  page?: number;
  size?: number;
  search?: string;
  sort_by?: string;
  order?: "asc" | "desc";
  actions?: string[];
}

export interface LatestAuditTrailData {
  sku_code?: string;
  location: string | null
  transactions: TransactionItem[]
}

export type Product = {
  sku_code: string
  name: string
  location: string
  available: number
  last_transaction: string
  status: "In Stock" | "Low Stock" | "Out of Stock"
}

export interface InventoryListParams {
  page?: number;
  size?: number;
  search?: string;
  sort_by?: string;
  order?: "asc" | "desc";
  stock_status?: string[];
}

export interface InventoryListResponse {
  items: Product[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// Helpers

// Builds a query string based on the optional location filter.
function buildQuery(location?: string): string {
  return location ? `?location=${encodeURIComponent(location)}` : "";
}

// API Functions

// Fetch inventory summary for a given SKU Code. Optionally filtered by location.
export async function getInventoryBySku(
  sku_code: string,
  location?: string
): Promise<InventorySnapshot> {
  return protectedApiClient<InventorySnapshot>(`/inventory/${sku_code}${buildQuery(location)}`);
}

// Fetch inventory trend data for a given SKU Code. Optionally filtered by location.
export async function getInventoryTrend(
  sku_code: string,
  period: string = "30d",
  location?: string
): Promise<InventoryTrend> {
  const params = new URLSearchParams({ period });
  if (location) params.append("location", location);
  return protectedApiClient<InventoryTrend>(`/reports/trend/inventory/${sku_code}?${params.toString()}`);
}

// Fetch latest inventory transactions for a given SKU Code. Optionally filtered by location.
export async function getLatestTransactionsBySku(
  sku_code: string,
  location?: string
): Promise<LatestAuditTrailData> {
  return protectedApiClient<LatestAuditTrailData>(`/transactions/latest/${sku_code}${buildQuery(location)}`);
}

export async function getInventoryList(
  params: InventoryListParams = {}
): Promise<InventoryListResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.page) searchParams.append("page", String(params.page));
  if (params.size) searchParams.append("size", String(params.size));
  if (params.search) searchParams.append("search", params.search);
  if (params.sort_by) {
    searchParams.append("sort_by", params.sort_by);
    searchParams.append("order", params.order || "asc");
  }
  if (params.stock_status) {
    params.stock_status.forEach((status) => {
      searchParams.append("stock_status", status);
    });
  }

  const query = searchParams.toString();
  return protectedApiClient<InventoryListResponse>(
    `/inventory${query ? `?${query}` : ""}`
  );
}

export async function getTransactions(
  params: TransactionsParams = {}
): Promise<TransactionsResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.page) searchParams.append("page", String(params.page));
  if (params.size) searchParams.append("size", String(params.size));
  if (params.search) searchParams.append("search", params.search);
  if (params.sort_by) {
    searchParams.append("sort_by", params.sort_by);
    searchParams.append("order", params.order || "asc");
  }
  if (params.actions) {
    params.actions.forEach((action) => searchParams.append("action", action));
  }

  return protectedApiClient<TransactionsResponse>(`/transactions?${searchParams.toString()}`);
}
