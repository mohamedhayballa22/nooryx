import { protectedApiClient } from "./protected-client";

// Types
export interface AlertBase {
  alert_type: "team_member_joined" | "low_stock";
  severity: "info" | "warning" | "critical";
  title: string;
  message?: string | null;
  alert_metadata?: Record<string, any> | null;
}

export interface AlertResponse extends AlertBase {
  id: string;
  aggregation_key?: string | null;
  is_read: boolean;
  created_at: string;
}

export interface UnreadCountResponse {
  count: number;
}

export interface MarkReadResponse {
  marked_count: number;
}

export interface AlertsStatusResponse {
  alerts_enabled: boolean;
}

export interface AlertsParams {
  page?: number;
  size?: number;
  read?: "read" | "unread";
  alert_type?: "team_member_joined" | "low_stock";
}

export interface AlertsResponse {
  items: AlertResponse[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

// API Functions

export async function getAlertsStatus(): Promise<AlertsStatusResponse> {
  return protectedApiClient<AlertsStatusResponse>("/alerts/status");
}

export async function getAlerts(
  params: AlertsParams = {}
): Promise<AlertsResponse> {
  const searchParams = new URLSearchParams();
  
  if (params.page) searchParams.append("page", String(params.page));
  if (params.size) searchParams.append("size", String(params.size));
  if (params.read) searchParams.append("read", params.read);
  if (params.alert_type) searchParams.append("alert_type", params.alert_type);

  const query = searchParams.toString();
  return protectedApiClient<AlertsResponse>(
    `/alerts${query ? `?${query}` : ""}`
  );
}

export async function getUnreadCount(): Promise<UnreadCountResponse> {
  return protectedApiClient<UnreadCountResponse>("/alerts/unread-count");
}

export async function markAlertAsRead(alertId: string): Promise<void> {
  await protectedApiClient(`/alerts/${alertId}/read`, {
    method: "POST",
  });
}

export async function markAllAlertsAsRead(): Promise<MarkReadResponse> {
  return protectedApiClient<MarkReadResponse>("/alerts/read-all", {
    method: "POST",
  });
}
