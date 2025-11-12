import { protectedApiClient } from "../protected-client";

export interface UserGeneralSettings {
  default_low_stock_threshold: number;
  default_reorder_point: number;
  locale: string;
  pagination: number;
  date_format: string;
  currency: string;
  valuation_method: string;
  alerts: boolean;
}

export interface UserGeneralSettingsUpdate {
  default_low_stock_threshold?: number;
  default_reorder_point?: number;
  locale?: string;
  pagination?: number;
  date_format?: string;
  role?: string;
  alerts?: boolean;
}

export async function getUserSettings(): Promise<UserGeneralSettings> {
  return protectedApiClient<UserGeneralSettings>("/settings", {
    method: "GET",
  });
}

export async function updateUserSettings(
  payload: UserGeneralSettingsUpdate
): Promise<void> {
  await protectedApiClient("/settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
