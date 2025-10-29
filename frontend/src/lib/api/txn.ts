import { protectedApiClient } from "./protected-client";

// TYPES
export interface BaseTxn {
  sku_code: string;
  location: string;
  txn_metadata?: Record<string, any>;
}

export interface ReceiveTxn extends BaseTxn {
  action: "receive";
  sku_name: string;
  qty: number; // positive
  cost_price: number; // positive
}

export interface ShipTxn extends BaseTxn {
  action: "ship";
  qty: number; // positive
  txn_metadata?: {
    ship_from?: "reserved" | "available" | "auto";
    [key: string]: any;
  };
}

export interface AdjustTxn extends BaseTxn {
  action: "adjust";
  qty: number; // positive or negative
  txn_metadata: { reason: string; [key: string]: any };
}

export interface ReserveTxn extends BaseTxn {
  action: "reserve";
  qty: number; // positive
  txn_metadata?: { order_id?: string; customer?: string; [key: string]: any };
}

export interface UnreserveTxn extends BaseTxn {
  action: "unreserve";
  qty: number; // positive
  txn_metadata?: { order_id?: string; reason?: string; [key: string]: any };
}

export interface TransferTxn {
  action: "transfer";
  sku_code: string;
  qty: number; // positive
  location: string; // source
  target_location: string; // destination
  txn_metadata?: Record<string, any>;
}

export type TransactionPayload =
  | ReceiveTxn
  | ShipTxn
  | AdjustTxn
  | ReserveTxn
  | UnreserveTxn
  | TransferTxn;

  
// Service function
export async function postTransaction<T extends TransactionPayload>(payload: T): Promise<void> {
  const endpointPath = `/${payload.action}`;
  await protectedApiClient(endpointPath, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
