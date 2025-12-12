"use client"

import { Button } from "@/components/ui/button"
import { Check, Clock, ExternalLink, Loader2, AlertCircle } from "lucide-react"
import { useShopifyStatus, useDisconnectShopify } from "@/hooks/use-shopify"
import type { Integration } from "./integrations-page"

interface IntegrationCardProps {
  integration: Integration
  onConnect: () => void
}

export function IntegrationCard({ integration, onConnect }: IntegrationCardProps) {
  const { name, description, icon, available } = integration

  // Fetch real-time status for Shopify
  const { data: shopifyStatus, isLoading: isLoadingShopify } = useShopifyStatus()
  const { mutate: disconnectShopify, isPending: isDisconnecting } = useDisconnectShopify()

  const isShopify = integration.id === "shopify"

  // Determine real status for Shopify
  const status = isShopify 
    ? shopifyStatus?.is_active 
      ? "connected" 
      : "not_connected"
    : integration.status

  const lastSync = isShopify && shopifyStatus?.updated_at
    ? formatLastSync(shopifyStatus.updated_at)
    : integration.lastSync

  const hasWebhookIssue = isShopify && shopifyStatus?.is_active && !shopifyStatus?.webhooks_installed

  const handleManage = () => {
    if (isShopify && shopifyStatus?.is_active) {
      // You could open a management dialog here
      // For now, just disconnect
      disconnectShopify()
    }
  }

  return (
    <div className="group flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-muted-foreground/30 hover:bg-muted/30">
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-foreground">
          {isLoadingShopify && isShopify ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            icon
          )}
        </div>

        {/* Info */}
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">{name}</h3>
            {!available && <ComingSoonBadge />}
            {available && !isLoadingShopify && <StatusBadge status={status} />}
            {hasWebhookIssue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-status-warning/10 px-2 py-0.5 text-[10px] font-medium text-status-warning">
                <AlertCircle className="h-3 w-3" />
                Webhook issue
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isShopify && shopifyStatus?.is_active 
              ? `Connected to ${shopifyStatus.shop_domain}`
              : description
            }
          </p>
          {lastSync && status === "connected" && (
            <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last synced {lastSync}
            </p>
          )}
        </div>
      </div>

      {/* Action */}
      <div className="flex items-center gap-2">
        {!available ? (
          <Button
            variant="ghost"
            size="sm"
            disabled
            className="h-8 cursor-not-allowed text-xs text-muted-foreground/50"
          >
            Coming soon
          </Button>
        ) : status === "connected" ? (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleManage}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? (
              <>
                <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                Disconnecting...
              </>
            ) : (
              <>
                Manage
                <ExternalLink className="ml-1.5 h-3 w-3" />
              </>
            )}
          </Button>
        ) : (
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={onConnect} 
            className="h-8 text-xs"
            disabled={isLoadingShopify && isShopify}
          >
            Connect
          </Button>
        )}
      </div>
    </div>
  )
}

function ComingSoonBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      Coming soon
    </span>
  )
}

function StatusBadge({ status }: { status: Integration["status"] }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-status-success/10 px-2 py-0.5 text-[10px] font-medium text-status-success">
        <Check className="h-3 w-3" />
        Connected
      </span>
    )
  }

  if (status === "pending") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-status-warning/10 px-2 py-0.5 text-[10px] font-medium text-status-warning">
        <Clock className="h-3 w-3" />
        Pending
      </span>
    )
  }

  return null
}

function formatLastSync(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))

  if (diffInMinutes < 1) return "just now"
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`
  
  const diffInHours = Math.floor(diffInMinutes / 60)
  if (diffInHours < 24) return `${diffInHours}h ago`
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}d ago`
  
  return date.toLocaleDateString()
}
