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

export interface InventoryItem {
  sku: string;
  product_name: string;
  status: string;
  location: string | null;
  locations: number;
  inventory_pct: number
  summary: InventorySummary;
}

export interface InventoryTrendPoint {
  date: string;
  on_hand: number;
}

export interface InventoryTrend {
  sku: string;
  location: string | null;
  points: InventoryTrendPoint[];
}

export interface InventoryTransaction {
  id: number;
  date: string;
  actor: string;
  action: string;
  quantity: number;
  sku: string;
  location: string;
  stock_before: number;
  stock_after: number;
  metadata: any;
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
): Promise<InventoryItem> {
  return apiClient<InventoryItem>(`/inventory/${sku}${buildQuery(location)}`);
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
): Promise<InventoryTransaction[]> {
  return apiClient<InventoryTransaction[]>(`/transactions/latest/${sku}${buildQuery(location)}`);
}
