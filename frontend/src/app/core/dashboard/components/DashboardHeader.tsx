"use client"

import { useMemo, useState } from "react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardSummary {
  first_name: string
  low_stock: number
  out_of_stock: number
  fast_mover_low_stock_sku: string[] | null
  fast_mover_out_of_stock_sku: string[] | null
  inactive_sku_in_stock: string[] | null
  empty_inventory: boolean
  locations: string[]
}

interface Props {
  data: DashboardSummary
  selectedTab: string
  onTabChange: (tab: string) => void
}

// Utility: clickable text parser
function formatMessageWithLinks(message: string) {
  const patterns = [
    {
      regex: /\b(\d+)\s+SKU(?:s)?\b/gi,
      replacer: (match: string, num: string) => {
        const isLow = message.toLowerCase().includes("low")
        const isOut = message.toLowerCase().includes("out of stock")
        const status = isOut ? "Out+of+Stock" : isLow ? "Low+Stock" : ""
        const href = `/core/inventory${status ? `?status=${status}` : ""}`
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-primary font-medium hover:underline hover:underline-offset-4 transition-colors">${match}</a>`
      },
    },
    {
      regex: /\bSKU-\d+\b/g,
      replacer: (match: string) => {
        const sku = match
        const href = `/core/inventory/${encodeURIComponent(sku)}`
        return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-primary font-medium hover:underline hover:underline-offset-4 transition-colors">${match}</a>`
      },
    },
  ]

  let formatted = message
  for (const { regex, replacer } of patterns) {
    formatted = formatted.replace(regex, replacer)
  }

  return formatted
}

export default function DashboardHeader({
  data,
  selectedTab,
  onTabChange,
}: Props) {
  const [expandedMessage, setExpandedMessage] = useState(false)
  
  const {
    first_name,
    low_stock,
    out_of_stock,
    fast_mover_low_stock_sku,
    fast_mover_out_of_stock_sku,
    inactive_sku_in_stock,
    empty_inventory,
    locations,
  } = data

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 18) return "Good afternoon"
    return "Good evening"
  }, [])

  const pluralize = (count: number) => (count === 1 ? "SKU" : "SKUs")

  const joinSkus = (skus: string[]): string => {
    if (skus.length === 0) return ""
    if (skus.length === 1) return skus[0]
    if (skus.length === 2) return `${skus[0]} and ${skus[1]}`
    const displayed = skus.slice(0, 2)
    return `${displayed.join(", ")} and others`
  }

  // Build message variants
  const { primary, full, hasExpanded } = useMemo(() => {
    if (empty_inventory) {
      return {
        primary: "Your inventory is currently empty.",
        full: "Your inventory is currently empty. Start by receiving new stock to get things moving.",
        hasExpanded: true,
      }
    }

    if (low_stock === 0 && out_of_stock === 0) {
      if (inactive_sku_in_stock?.length) {
        const joined = joinSkus(inactive_sku_in_stock)
        const plural = inactive_sku_in_stock.length > 1
        return {
          primary: `${joined} ${plural ? "have" : "has"} not moved in over 10 days.`,
          full: `All SKUs are well stocked, but ${joined} ${plural ? "have" : "has"} not moved in over 10 days. These items are tying up capital.`,
          hasExpanded: true,
        }
      }
      return {
        primary: "Your inventory looks healthy.",
        full: "Your inventory looks healthy. All SKUs are well stocked.",
        hasExpanded: false,
      }
    }

    if (low_stock > 0 && out_of_stock === 0) {
      if (fast_mover_low_stock_sku?.length) {
        const joined = joinSkus(fast_mover_low_stock_sku)
        const plural = fast_mover_low_stock_sku.length > 1
        return {
          primary: `${joined} ${plural ? "are" : "is"} running low.`,
          full: `Most SKUs are in good shape, but ${joined} ${plural ? "are" : "is"} moving out quickly but running low. Replenish them soon.`,
          hasExpanded: true,
        }
      }
      return {
        primary: `${low_stock} ${pluralize(low_stock)} running low.`,
        full: `${low_stock} ${pluralize(low_stock)} ${low_stock === 1 ? "is" : "are"} running low. Consider restocking soon.`,
        hasExpanded: true,
      }
    }

    if (out_of_stock > 0 && low_stock === 0) {
      if (fast_mover_out_of_stock_sku?.length) {
        const joined = joinSkus(fast_mover_out_of_stock_sku)
        const plural = fast_mover_out_of_stock_sku.length > 1
        return {
          primary: `${out_of_stock} ${pluralize(out_of_stock)} out of stock.`,
          full: `${out_of_stock} ${pluralize(out_of_stock)} ${out_of_stock === 1 ? "is" : "are"} completely out of stock, including fast movers such as ${joined}. Replenish ${plural ? "them" : "it"} immediately.`,
          hasExpanded: true,
        }
      }
      return {
        primary: `${out_of_stock} ${pluralize(out_of_stock)} out of stock.`,
        full: `${out_of_stock} ${pluralize(out_of_stock)} ${out_of_stock === 1 ? "is" : "are"} completely out of stock. Restocking should be your top priority.`,
        hasExpanded: true,
      }
    }

    if (low_stock > 0 && out_of_stock > 0) {
      return {
        primary: `${out_of_stock} out of stock, ${low_stock} running low.`,
        full: buildFullMessage(out_of_stock, low_stock, fast_mover_out_of_stock_sku, fast_mover_low_stock_sku, inactive_sku_in_stock, pluralize, joinSkus),
        hasExpanded: true,
      }
    }

    return { primary: "Monitoring inventory health...", full: "Monitoring inventory health...", hasExpanded: false }
  }, [low_stock, out_of_stock, fast_mover_low_stock_sku, fast_mover_out_of_stock_sku, inactive_sku_in_stock, empty_inventory])

  const displayedMessage = expandedMessage ? full : primary
  const clickableMessage = formatMessageWithLinks(displayedMessage)

  return (
    <div className="flex flex-col gap-6 pb-1">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {greeting}, {first_name}
        </h1>

        {/* Message with max width and clickable content */}
        <div className="space-y-2 max-w-[800px]">
          <p
            className="text-base text-md text-foreground leading-relaxed"
            dangerouslySetInnerHTML={{ __html: clickableMessage }}
          />
          {hasExpanded && (
            <button
              onClick={() => setExpandedMessage(!expandedMessage)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              {expandedMessage ? "Show less" : "See more"}
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform duration-200",
                  expandedMessage && "rotate-180"
                )}
              />
            </button>
          )}
        </div>
      </div>

      {/* Location Tabs */}
      {locations.length > 1 && (
        <Tabs value={selectedTab} onValueChange={onTabChange} className="w-full">
          <TabsList className="flex flex-wrap gap-2 bg-transparent border-b border-border p-0">
            <TabsTrigger
              value="all"
              className={cn(
                "px-3 py-2 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary transition-colors"
              )}
            >
              All Locations
            </TabsTrigger>
            {locations.map((loc) => (
              <TabsTrigger
                key={loc}
                value={loc}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary transition-colors"
                )}
              >
                {loc}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
    </div>
  )
}

// Helper: builds long message
function buildFullMessage(
  out_of_stock: number,
  low_stock: number,
  fast_mover_out_of_stock_sku: string[] | null,
  fast_mover_low_stock_sku: string[] | null,
  inactive_sku_in_stock: string[] | null,
  pluralize: (count: number) => string,
  joinSkus: (skus: string[]) => string
): string {
  const parts: string[] = []
  parts.push(`${out_of_stock} ${pluralize(out_of_stock)} ${out_of_stock === 1 ? "is" : "are"} completely out of stock`)
  parts.push(`${low_stock} ${pluralize(low_stock)} ${low_stock === 1 ? "is" : "are"} running low`)

  let extra = ""
  if (fast_mover_out_of_stock_sku?.length) {
    const joined = joinSkus(fast_mover_out_of_stock_sku)
    const plural = fast_mover_out_of_stock_sku.length > 1
    extra += ` ${joined} ${plural ? "are" : "is"} among your fastest moving items and currently out of stock.`
  } else if (fast_mover_low_stock_sku?.length) {
    const joined = joinSkus(fast_mover_low_stock_sku)
    const plural = fast_mover_low_stock_sku.length > 1
    extra += ` ${joined} ${plural ? "are" : "is"} fast moving and running low.`
  }

  if (inactive_sku_in_stock?.length) {
    const joinedInactive = joinSkus(inactive_sku_in_stock)
    const plural = inactive_sku_in_stock.length > 1
    extra += ` Additionally, ${joinedInactive} ${plural ? "have" : "has"} not moved in over 10 days.`
  }

  return `${parts.join(", and ")}.${extra}`
}

// Skeleton
DashboardHeader.Skeleton = function DashboardHeaderSkeleton() {
  return (
    <div className="flex flex-col gap-6 pb-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-64" />
        <div className="space-y-2 max-w-prose">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-96" />
          <Skeleton className="h-4 w-20 mt-2" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2 border-b border-border pb-1">
        <Skeleton className="h-8 w-28 rounded-none" />
        <Skeleton className="h-8 w-24 rounded-none" />
        <Skeleton className="h-8 w-24 rounded-none" />
      </div>
    </div>
  )
}
