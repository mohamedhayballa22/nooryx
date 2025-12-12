"use client"

import type React from "react"
import { useState } from "react"

// Icons
import { 
  SiShopify, 
  SiAmazon, 
  SiWoocommerce, 
  SiBigcommerce, 
  SiEtsy, 
  SiSquare 
} from "react-icons/si"

// Local imports
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { IntegrationCard } from "./integration-card"
import { ShopifyConnectDialog } from "./shopify-connect-dialog"
import { ShopifyErrorModal } from "./shopify-error-modal"

const ICON_SIZE = 20

// Export type
export type Integration = {
  id: string
  name: string
  description: string
  icon: React.ReactNode 
  status: "connected" | "disconnected" | "pending" | "not_connected"
  category: "marketplace" | "ecommerce"
  lastSync?: string
  available: boolean
}

const integrations: Integration[] = [
  {
    id: "shopify",
    name: "Shopify",
    description: "Sync products and orders from your Shopify store",
    icon: <SiShopify size={ICON_SIZE} />, 
    status: "disconnected", // Will be overridden by useShopifyStatus
    category: "ecommerce",
    available: true,
  },
  {
    id: "amazon",
    name: "Amazon",
    description: "Connect Amazon Seller Central for unified inventory",
    icon: <SiAmazon size={ICON_SIZE} />, 
    status: "disconnected",
    category: "marketplace",
    available: false,
  },
  {
    id: "woocommerce",
    name: "WooCommerce",
    description: "Integrate with your WordPress WooCommerce store",
    icon: <SiWoocommerce size={ICON_SIZE} />, 
    status: "disconnected",
    category: "ecommerce",
    available: false,
  },
  {
    id: "bigcommerce",
    name: "BigCommerce",
    description: "Manage listings and inventory across BigCommerce marketplaces",
    icon: <SiBigcommerce size={ICON_SIZE} />, 
    status: "disconnected",
    category: "marketplace",
    available: false,
  },
  {
    id: "etsy",
    name: "Etsy",
    description: "Sync handmade and vintage item listings",
    icon: <SiEtsy size={ICON_SIZE} />, 
    status: "disconnected",
    category: "marketplace",
    available: false,
  },
  {
    id: "square",
    name: "Square",
    description: "Connect your Square POS for in-store inventory",
    icon: <SiSquare size={ICON_SIZE} />, 
    status: "disconnected",
    category: "ecommerce",
    available: false,
  },
]

export function IntegrationsPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const filteredIntegrations = integrations.filter(
    (integration) =>
      integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleConnect = (integration: Integration) => {
    if (!integration.available) return
    setSelectedIntegration(integration)
    setDialogOpen(true)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <main className="flex-1 px-6 py-8 lg:px-12">
          <div className="mx-auto max-w-5xl">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Integrations</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Connect your sales channels to sync inventory in real-time
              </p>
            </div>

            {/* Search */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search integrations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 bg-muted/50 pl-9 text-sm placeholder:text-muted-foreground focus-visible:bg-muted"
              />
            </div>

            {/* Integration Grid */}
            <div className="grid gap-3">
              {filteredIntegrations.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  onConnect={() => handleConnect(integration)}
                />
              ))}
            </div>

            {filteredIntegrations.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No integrations found matching "{searchQuery}"</p>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Connection Dialog */}
      <ShopifyConnectDialog 
        integration={selectedIntegration} 
        open={dialogOpen} 
        onOpenChange={setDialogOpen} 
      />

      <ShopifyErrorModal />
    </div>
  )
}
