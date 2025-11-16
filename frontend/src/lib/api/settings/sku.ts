import { protectedApiClient } from "../protected-client";

export interface UpdateSKUPayload {
  sku_code: string;
  alerts?: boolean;
  reorder_point?: number;
  low_stock_threshold?: number;
}

export async function updateSKU(
  payload: UpdateSKUPayload
): Promise<void> {
  const { sku_code, ...updateData } = payload; 

  await protectedApiClient(`/settings/${encodeURIComponent(sku_code)}`, {
    method: "PATCH",
    body: JSON.stringify(updateData), 
  });
}
