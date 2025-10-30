"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { NavArrowDown } from "iconoir-react"
import { cn } from "@/lib/utils"
import { DashboardSummary } from "@/lib/api/dashboard"

interface Props {
  data: DashboardSummary
  selectedLocation: string
  onTabChange: (tab: string) => void
}

// Utility: determines if truncation is worthwhile (works with plain text)
function shouldShowToggle(primary: string, full: string): boolean {
  if (primary === full) return false

  const primaryWords = primary.split(/\s+/).length
  const fullWords = full.split(/\s+/).length
  const wordDiff = fullWords - primaryWords

  const MIN_WORD_DIFFERENCE = 20
  const MIN_PERCENTAGE_INCREASE = 0.6

  const percentageIncrease = (fullWords - primaryWords) / primaryWords
  return wordDiff >= MIN_WORD_DIFFERENCE && percentageIncrease >= MIN_PERCENTAGE_INCREASE
}

// Type for link data
interface LinkData {
  href: string
  text: string
}

// Helper to create SKU link data
function createSkuLinkData(sku: string): LinkData {
  return {
    href: `/core/inventory?sku=${encodeURIComponent(sku)}`,
    text: sku,
  }
}

// Helper to create count link data
function createCountLinkData(count: number, status: "low" | "out"): LinkData {
  const text = `${count} ${count === 1 ? "SKU" : "SKUs"}`
  const statusParam = status === "out" ? "Out+of+Stock" : "Low+Stock"
  return {
    href: `/core/inventory?status=${statusParam}`,
    text,
  }
}

// Reusable Link Component
function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-primary font-medium hover:underline hover:underline-offset-4 transition-colors"
    >
      {children}
    </Link>
  )
}

// Helper: render a limited list of SKU links with natural “and” joining
function renderSkuLinks(skus: string[], limit = 2): React.ReactNode {
  if (!skus?.length) return null
  const display = skus.slice(0, limit)
  return (
    <>
      {display.map((sku, i) => (
        <span key={sku}>
          {i > 0 && (i === display.length - 1 ? " and " : ", ")}
          <InlineLink href={`/core/inventory?sku=${encodeURIComponent(sku)}`}>{sku}</InlineLink>
        </span>
      ))}
      {skus.length > limit && " and others"}
    </>
  )
}

export default function DashboardHeader({ data, selectedLocation, onTabChange }: Props) {
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

  // Build message component
  const message = useMemo(() => {
    // Empty inventory
    if (empty_inventory) {
      const primary = "Your inventory is currently empty."
      const full =
        "Your inventory is currently empty. Start by receiving new stock to get things moving."
      return {
        primary: <span>{primary}</span>,
        full: <span>{full}</span>,
        canExpand: shouldShowToggle(primary, full),
      }
    }

    // Healthy inventory but inactive SKUs
    if (low_stock === 0 && out_of_stock === 0) {
      if (inactive_sku_in_stock?.length) {
        const skus = renderSkuLinks(inactive_sku_in_stock)
        const plural = inactive_sku_in_stock.length > 1
        const primaryText = `${inactive_sku_in_stock.slice(0, 2).join(", ")} ${
          plural ? "have" : "has"
        } not moved in over 10 days.`
        const fullText = `All SKUs are well stocked, but some items have not moved in over 10 days.`
        const canExpand = shouldShowToggle(primaryText, fullText)
        return {
          primary: (
            <span>
              {skus} {plural ? "have" : "has"} not moved in over 10 days.
            </span>
          ),
          full: (
            <span>
              All SKUs are well stocked, but {skus} {plural ? "have" : "has"} not moved in over 10
              days. These items are tying up capital.
            </span>
          ),
          canExpand,
        }
      }
      const msg = <span>Your inventory looks healthy. All SKUs are well stocked.</span>
      return { primary: msg, full: msg, canExpand: false }
    }

    // Low stock only
    if (low_stock > 0 && out_of_stock === 0) {
      const linkData = createCountLinkData(low_stock, "low")
      if (fast_mover_low_stock_sku?.length) {
        const skus = renderSkuLinks(fast_mover_low_stock_sku)
        const plural = fast_mover_low_stock_sku.length > 1
        return {
          primary: (
            <span>
              {skus} {plural ? "are" : "is"} running low.
            </span>
          ),
          full: (
            <span>
              Most SKUs are in good shape, but {skus} {plural ? "are" : "is"} moving out quickly and
              running low. Consider restocking soon.
            </span>
          ),
          canExpand: true,
        }
      }
      return {
        primary: (
          <span>
            <InlineLink href={linkData.href}>{linkData.text}</InlineLink> running low.
          </span>
        ),
        full: (
          <span>
            <InlineLink href={linkData.href}>{linkData.text}</InlineLink>{" "}
            {low_stock === 1 ? "is" : "are"} running low. Consider restocking soon.
          </span>
        ),
        canExpand: true,
      }
    }

    // Out of stock only
    if (out_of_stock > 0 && low_stock === 0) {
      const linkData = createCountLinkData(out_of_stock, "out")
      if (fast_mover_out_of_stock_sku?.length) {
        const skus = renderSkuLinks(fast_mover_out_of_stock_sku)
        const plural = fast_mover_out_of_stock_sku.length > 1
        return {
          primary: (
            <span>
              <InlineLink href={linkData.href}>{linkData.text}</InlineLink> out of stock.
            </span>
          ),
          full: (
            <span>
              <InlineLink href={linkData.href}>{linkData.text}</InlineLink>{" "}
              {out_of_stock === 1 ? "is" : "are"} completely out of stock, including fast movers such
              as {skus}. Replenish {plural ? "them" : "it"} immediately.
            </span>
          ),
          canExpand: true,
        }
      }
      return {
        primary: (
          <span>
            <InlineLink href={linkData.href}>{linkData.text}</InlineLink> out of stock.
          </span>
        ),
        full: (
          <span>
            <InlineLink href={linkData.href}>{linkData.text}</InlineLink>{" "}
            {out_of_stock === 1 ? "is" : "are"} completely out of stock. Restocking should be your
            top priority.
          </span>
        ),
        canExpand: true,
      }
    }

    // Both low and out of stock
    if (low_stock > 0 && out_of_stock > 0) {
      const outLink = createCountLinkData(out_of_stock, "out")
      const lowLink = createCountLinkData(low_stock, "low")
      return {
        primary: (
          <span>
            <InlineLink href={outLink.href}>{outLink.text}</InlineLink> out of stock,{" "}
            <InlineLink href={lowLink.href}>{lowLink.text}</InlineLink> running low.
          </span>
        ),
        full: buildFullMessageComponent(
          out_of_stock,
          low_stock,
          fast_mover_out_of_stock_sku,
          fast_mover_low_stock_sku,
          inactive_sku_in_stock
        ),
        canExpand: true,
      }
    }

    const msg = <span>Monitoring inventory health...</span>
    return { primary: msg, full: msg, canExpand: false }
  }, [
    low_stock,
    out_of_stock,
    fast_mover_low_stock_sku,
    fast_mover_out_of_stock_sku,
    inactive_sku_in_stock,
    empty_inventory,
  ])

  const displayedMessage = expandedMessage ? message.full : message.primary

  return (
    <div className="flex flex-col gap-6 pb-1">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          {greeting}, {first_name}
        </h1>

        {/* Message */}
        <div className="space-y-2 max-w-[800px]">
          <p className="text-base text-md text-foreground leading-relaxed">{displayedMessage}</p>
          {message.canExpand && (
            <button
              onClick={() => setExpandedMessage(!expandedMessage)}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              {expandedMessage ? "Show less" : "See more"}
              <NavArrowDown
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
        <Tabs value={selectedLocation} onValueChange={onTabChange} className="w-full">
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

// Helper: builds long message component
function buildFullMessageComponent(
  out_of_stock: number,
  low_stock: number,
  fast_mover_out_of_stock_sku: string[] | null,
  fast_mover_low_stock_sku: string[] | null,
  inactive_sku_in_stock: string[] | null
): React.ReactNode {
  const outLink = createCountLinkData(out_of_stock, "out")
  const lowLink = createCountLinkData(low_stock, "low")

  return (
    <span>
      <InlineLink href={outLink.href}>{outLink.text}</InlineLink>{" "}
      {out_of_stock === 1 ? "is" : "are"} completely out of stock, and{" "}
      <InlineLink href={lowLink.href}>{lowLink.text}</InlineLink>{" "}
      {low_stock === 1 ? "is" : "are"} running low.
      {fast_mover_out_of_stock_sku?.length ? (
        <>
          {" "}
          {renderSkuLinks(fast_mover_out_of_stock_sku)}{" "}
          {fast_mover_out_of_stock_sku.length > 1 ? "are" : "is"} among your fastest moving items
          and currently out of stock.
        </>
      ) : fast_mover_low_stock_sku?.length ? (
        <>
          {" "}
          {renderSkuLinks(fast_mover_low_stock_sku)}{" "}
          {fast_mover_low_stock_sku.length > 1 ? "are" : "is"} fast moving and running low.
        </>
      ) : null}
      {inactive_sku_in_stock?.length && (
        <>
          {" Additionally, "}
          {renderSkuLinks(inactive_sku_in_stock)}{" "}
          {inactive_sku_in_stock.length > 1 ? "have" : "has"} not moved in over 10 days.
        </>
      )}
    </span>
  )
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
