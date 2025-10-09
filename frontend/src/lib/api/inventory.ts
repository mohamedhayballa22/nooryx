import { apiClient } from "./client";

// --- Types ---
export interface InventorySummary {
  available: number;
  reserved: number;
  on_hand: {
    value: number;
    delta_pct: number;
  };
}

export interface InventorySnapshot {
  sku: string;
  product_name: string;
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
  sku: string;
  locations: number;
  location: string | null;
  oldest_data_point: string;
  points: InventoryTrendPoint[];
}

export interface SkuTransactionItem {
  id: number
  date: string
  actor: string
  action: string
  quantity: number
  sku: string
  location?: string
  stock_before: number
  stock_after: number
  metadata?: {
    target_location?: string
    source_location?: string
    [key: string]: any
  } | null
}

export interface SkuAuditTrailData {
  sku: string
  locations: number
  location?: string | null
  transactions: SkuTransactionItem[]
}

export type Product = {
  sku: string
  product_name: string
  location: string
  available: number
  last_transaction: string
  status: "In Stock" | "Low stock" | "Out of Stock"
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

// --- Helpers ---


// Builds a query string based on the optional location filter.
function buildQuery(location?: string): string {
  return location ? `?location=${encodeURIComponent(location)}` : "";
}

// --- API Functions ---

// Fetch inventory summary for a given SKU. Optionally filtered by location.
export async function getInventoryBySku(
  sku: string,
  location?: string
): Promise<InventorySnapshot> {
  return apiClient<InventorySnapshot>(`/inventory/${sku}${buildQuery(location)}`);
}

//Fetch inventory trend data for a given SKU. Optionally filtered by location.
export async function getInventoryTrend(
  sku: string,
  period: string = "30d",
  location?: string
): Promise<InventoryTrend> {
  const params = new URLSearchParams({ period });
  if (location) params.append("location", location);
  return apiClient<InventoryTrend>(`/inventory/trend/${sku}?${params.toString()}`);
}

// Fetch latest inventory transactions for a given SKU. Optionally filtered by location.
export async function getLatestTransactions(
  sku: string,
  location?: string
): Promise<SkuAuditTrailData> {
  return apiClient<SkuAuditTrailData>(`/transactions/latest/${sku}${buildQuery(location)}`);
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
  return apiClient<InventoryListResponse>(
    `/inventory${query ? `?${query}` : ""}`
  );
}
