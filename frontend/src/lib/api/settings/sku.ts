import { protectedApiClient } from "../protected-client";

export interface updateSKUPayload {
  sku_code: string;
  alerts?: boolean;
  reorder_point?: number;
  low_stock_threshold?: number;
}

export async function updateSKU(
  payload: updateSKUPayload
): Promise<void> {
  const { sku_code, ...updateData } = payload; 

  await protectedApiClient(`/settings/${sku_code}`, {
    method: "PATCH",
    body: JSON.stringify(updateData), 
  });
}
