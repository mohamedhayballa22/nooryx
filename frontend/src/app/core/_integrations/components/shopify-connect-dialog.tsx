"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowRight, ExternalLink, Lock, RefreshCw, Store } from "lucide-react"
import { useConnectShopify, useShopifyStatus } from "@/hooks/use-shopify"
import { toast } from "sonner"
import type { Integration } from "./integrations-page"

interface ShopifyConnectDialogProps {
  integration: Integration | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ShopifyConnectDialog({ integration, open, onOpenChange }: ShopifyConnectDialogProps) {
  const [shopDomain, setShopDomain] = useState("")
  const searchParams = useSearchParams()
  
  const { mutate: connect, isPending: isConnecting } = useConnectShopify()
  const { refetch: refetchStatus } = useShopifyStatus()

  // Handle OAuth callback success only
  useEffect(() => {
    const shopifyConnected = searchParams.get('shopify_connected')

    if (shopifyConnected === 'true') {
      toast.success('Shopify connected successfully!')
      refetchStatus()
      
      // Clean up URL parameters
      const url = new URL(window.location.href)
      url.searchParams.delete('shopify_connected')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams, refetchStatus])

  if (!integration || integration.id !== "shopify") return null

  const handleConnect = () => {
    // Validate and clean shop domain
    const cleanDomain = shopDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\.myshopify\.com.*$/, "")
      .replace(/[^a-z0-9-]/g, "")

    if (!cleanDomain) {
      toast.error("Please enter your store name")
      return
    }

    // Add .myshopify.com if not present
    const fullDomain = cleanDomain.endsWith('.myshopify.com') 
      ? cleanDomain 
      : `${cleanDomain}.myshopify.com`

    // Call the backend API which will return the OAuth URL
    connect({ shop_domain: fullDomain })
  }

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setShopDomain(e.target.value)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 overflow-hidden border-border bg-card p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#96bf48]/10 text-[#96bf48]">
              {integration.icon}
            </div>
            <div>
              <DialogTitle className="text-base font-medium">Connect to Shopify</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Link your store to sync products and orders
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="px-6 py-5">
          {/* How it works section */}
          <div className="mb-6 rounded-lg bg-muted/50 p-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">How it works</p>
            <div className="space-y-3">
              <Step number={1} icon={<Store className="h-3.5 w-3.5" />} text="Enter your Shopify store name" />
              <Step
                number={2}
                icon={<ExternalLink className="h-3.5 w-3.5" />}
                text="You'll be redirected to Shopify to grant access"
              />
              <Step number={3} icon={<RefreshCw className="h-3.5 w-3.5" />} text="Your inventory syncs automatically" />
            </div>
          </div>

          {/* Store domain input */}
          <div className="space-y-2">
            <Label htmlFor="shop-domain" className="text-xs font-medium text-foreground">
              Store name
            </Label>
            <div className="flex items-center">
              <Input
                id="shop-domain"
                placeholder="your-store"
                value={shopDomain}
                onChange={handleDomainChange}
                className="h-10 rounded-r-none border-r-0 bg-background text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
                onKeyDown={(e) => e.key === "Enter" && !isConnecting && handleConnect()}
                disabled={isConnecting}
              />
              <div className="flex h-10 items-center rounded-r-md border border-l-0 border-border bg-muted px-3">
                <span className="text-xs text-muted-foreground">.myshopify.com</span>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Find this in your Shopify admin URL: <span className="font-mono text-foreground/70">your-store</span>
              .myshopify.com
            </p>
          </div>

          {/* Security note */}
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-border/50 bg-background p-3">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Secure OAuth 2.0 authentication. We never store your Shopify password. You can revoke access anytime from
              your Shopify admin.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border bg-muted/30 px-6 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs text-muted-foreground"
            disabled={isConnecting}
          >
            Cancel
          </Button>
          <Button 
            size="sm" 
            onClick={handleConnect} 
            disabled={isConnecting || !shopDomain.trim()} 
            className="text-xs"
          >
            {isConnecting ? (
              <>
                <RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                Continue to Shopify
                <ArrowRight className="ml-1.5 h-3 w-3" />
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Step({ number, icon, text }: { number: number; icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-background text-muted-foreground">
        {icon}
      </div>
      <span className="text-xs text-foreground">{text}</span>
    </div>
  )
}
