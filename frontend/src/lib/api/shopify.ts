import { protectedApiClient } from "./protected-client";

// --- Types ---
export interface ShopifyConnectRequest {
  shop_domain: string;
}

export interface ShopifyOAuthUrlResponse {
  authorization_url: string;
  state: string;
}

export interface ShopifyIntegrationResponse {
  id: string;
  org_id: string;
  shop_domain: string;
  scopes: string;
  is_active: boolean;
  webhooks_installed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ShopifyDisconnectResponse {
  message: string;
  disconnected_at: string;
}

// --- Shopify API ---
export const shopifyService = {
  /** Initiate Shopify OAuth flow - returns authorization URL */
  async connect(
    data: ShopifyConnectRequest
  ): Promise<ShopifyOAuthUrlResponse> {
    return protectedApiClient<ShopifyOAuthUrlResponse>(
      "/shopify/connect",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  /** Get current Shopify integration status */
  async getStatus(): Promise<ShopifyIntegrationResponse | null> {
    return protectedApiClient<ShopifyIntegrationResponse | null>(
      "/shopify/status"
    );
  },

  /** Disconnect Shopify integration */
  async disconnect(): Promise<ShopifyDisconnectResponse> {
    return protectedApiClient<ShopifyDisconnectResponse>(
      "/shopify/disconnect",
      { method: "DELETE" }
    );
  },
};
