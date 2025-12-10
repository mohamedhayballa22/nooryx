"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { NavArrowDown } from "iconoir-react"
import { cn } from "@/lib/utils"
import { DashboardSummary } from "@/lib/api/dashboard"
import { ReceiveForm } from "@/components/forms/receive-form"

interface Props {
  data: DashboardSummary
  selectedLocation: string
  onTabChange: (tab: string) => void
}

// MESSAGE CONFIGURATION

type MessageVariables = {
  outCount?: number
  lowCount?: number
  outSkus?: string[]
  lowSkus?: string[]
  inactiveSkus?: string[]
}

type MessageBuilder = (vars: MessageVariables) => {
  primary: string
  full: string
  requiresExpansion: boolean
}

const DASHBOARD_MESSAGES = {
  greetings: {
    morning: "Good morning",
    afternoon: "Good afternoon",
    evening: "Good evening",
  },

  inventory: {
    empty: {
      primary: "Your inventory is currently empty.",
      full: "Your inventory is currently empty. Start by receiving new stock to get things moving.",
    },

    healthy: {
      primary: "Your inventory looks healthy. All SKUs are well stocked.",
      full: "Your inventory looks healthy. All SKUs are well stocked.",
    },

    healthyWithInactive: {
      primary: (vars: MessageVariables) =>
        `{{skus}} ${vars.inactiveSkus!.length > 1 ? "have" : "has"} not moved in over 10 days.`,
      full: (vars: MessageVariables) =>
        `All SKUs are well stocked, but {{skus}} ${vars.inactiveSkus!.length > 1 ? "have" : "has"} not moved in over 10 days. ${vars.inactiveSkus!.length > 1 ? "These items" : "This item"} may be tying up capital.`,
    },

    lowStockOnly: {
      withFastMovers: {
        primary: (vars: MessageVariables) =>
          `{{skus}} ${vars.lowSkus!.length > 1 ? "are" : "is"} running low.`,
        full: (vars: MessageVariables) =>
          `Most SKUs are in good shape, but {{skus}} ${vars.lowSkus!.length > 1 ? "are" : "is"} moving out quickly and running low. Consider restocking soon.`,
      },
      generic: {
        primary: (vars: MessageVariables) => `{{lowCount}} running low.`,
        full: (vars: MessageVariables) =>
          `{{lowCount}} ${vars.lowCount === 1 ? "is" : "are"} running low. Consider restocking soon.`,
      },
    },

    outOfStockOnly: {
      withFastMovers: {
        primary: (vars: MessageVariables) => `{{count}} out of stock.`,
        full: (vars: MessageVariables) => {
          const allAreFastMovers = vars.outCount === vars.outSkus!.length
          
          if (allAreFastMovers) {
            // Don't list SKUs when all are fast movers
            return `{{count}} ${vars.outCount === 1 ? "is" : "are"} out of stock. ${vars.outCount === 1 ? "This is a" : "All are"} fast-moving ${vars.outCount === 1 ? "item" : "items"}. Consider replenishing ${vars.outCount === 1 ? "it" : "them"}.`
          }
          
          // Only list SKUs if there are 2 or fewer fast movers
          if (vars.outSkus!.length <= 2) {
            return `{{count}} ${vars.outCount === 1 ? "is" : "are"} out of stock, including fast movers such as {{skus}}. Consider replenishing ${vars.outSkus!.length > 1 ? "them" : "it"}.`
          }
          
          // More than 2 fast movers in a partial subset - don't list them
          return `{{count}} ${vars.outCount === 1 ? "is" : "are"} out of stock, including ${vars.outSkus!.length} fast-moving ${vars.outSkus!.length === 1 ? "item" : "items"}. Consider replenishing them.`
        },
      },
      generic: {
        primary: (vars: MessageVariables) => `{{count}} out of stock.`,
        full: (vars: MessageVariables) =>
          `{{count}} ${vars.outCount === 1 ? "is" : "are"} out of stock. Consider restocking.`,
      },
    },

    bothStockIssues: {
      primary: (vars: MessageVariables) =>
        `{{outCount}} out of stock, {{lowCount}} running low.`,
      full: (vars: MessageVariables) => {
        let message = `{{outCount}} ${vars.outCount === 1 ? "is" : "are"} out of stock, and {{lowCount}} ${vars.lowCount === 1 ? "is" : "are"} running low.`

        if (vars.outSkus?.length) {
          message += ` {{outSkus}} ${vars.outSkus.length > 1 ? "are" : "is"} among your fastest moving items and currently out of stock.`
        } else if (vars.lowSkus?.length) {
          message += ` {{lowSkus}} ${vars.lowSkus.length > 1 ? "are" : "is"} fast moving and running low.`
        }

        if (vars.inactiveSkus?.length) {
          message += ` Additionally, {{inactiveSkus}} ${vars.inactiveSkus.length > 1 ? "have" : "has"} not moved in over 10 days.`
        }

        return message
      },
    },

    fallback: {
      primary: "Monitoring inventory health...",
      full: "Monitoring inventory health...",
    },
  },

  actions: {
    showMore: "See more",
    showLess: "Show less",
  },

  links: {
    skuSingular: "SKU",
    skuPlural: "SKUs",
    lowStockFilter: "Low+Stock",
    outOfStockFilter: "Out+of+Stock",
  },

  tabs: {
    allLocations: "All Locations",
  },
} as const

// UTILITIES

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

// LINK HELPERS

interface LinkData {
  href: string
  text: string
}

function createCountLinkData(count: number, status: "low" | "out"): LinkData {
  const text = `${count} ${count === 1 ? DASHBOARD_MESSAGES.links.skuSingular : DASHBOARD_MESSAGES.links.skuPlural}`
  const statusParam =
    status === "out"
      ? DASHBOARD_MESSAGES.links.outOfStockFilter
      : DASHBOARD_MESSAGES.links.lowStockFilter
  return {
    href: `/core/inventory?status=${statusParam}`,
    text,
  }
}

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

function renderSkuLinks(skus: string[], limit = 2): React.ReactNode {
  if (!skus?.length) return null
  const display = skus.slice(0, limit)
  const hasMore = skus.length > limit
  
  return (
    <>
      {display.map((sku, i) => (
        <span key={sku}>
          {i > 0 && (i === display.length - 1 && !hasMore ? " and " : ", ")}
          <InlineLink href={`/core/inventory?sku=${encodeURIComponent(sku)}`}>{sku}</InlineLink>
        </span>
      ))}
      {hasMore && ", and others"}
    </>
  )
}

// MESSAGE INTERPOLATION

function interpolateMessage(
  template: string,
  vars: MessageVariables,
  withLinks: boolean = true
): React.ReactNode {
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let keyIndex = 0 // Add a counter for keys

  const regex = /\{\{(outCount|lowCount|outSkus|lowSkus|inactiveSkus|count|skus)\}\}/g
  let match: RegExpExecArray | null

  while ((match = regex.exec(template)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`text-${keyIndex++}`}>{template.slice(lastIndex, match.index)}</span>)
    }

    const varName = match[1]

    switch (varName) {
      case "outCount":
        if (withLinks && vars.outCount !== undefined) {
          const linkData = createCountLinkData(vars.outCount, "out")
          parts.push(<InlineLink key={`link-${keyIndex++}`} href={linkData.href}>{linkData.text}</InlineLink>)
        } else {
          parts.push(<span key={`text-${keyIndex++}`}>{String(vars.outCount)}</span>)
        }
        break

      case "lowCount":
        if (withLinks && vars.lowCount !== undefined) {
          const linkData = createCountLinkData(vars.lowCount, "low")
          parts.push(<InlineLink key={`link-${keyIndex++}`} href={linkData.href}>{linkData.text}</InlineLink>)
        } else {
          parts.push(<span key={`text-${keyIndex++}`}>{String(vars.lowCount)}</span>)
        }
        break

      case "count":
        if (vars.outCount !== undefined) {
          const linkData = createCountLinkData(vars.outCount, "out")
          parts.push(<InlineLink key={`link-${keyIndex++}`} href={linkData.href}>{linkData.text}</InlineLink>)
        } else if (vars.lowCount !== undefined) {
          const linkData = createCountLinkData(vars.lowCount, "low")
          parts.push(<InlineLink key={`link-${keyIndex++}`} href={linkData.href}>{linkData.text}</InlineLink>)
        }
        break

      case "outSkus":
        if (vars.outSkus?.length) {
          parts.push(<span key={`skus-${keyIndex++}`}>{renderSkuLinks(vars.outSkus)}</span>)
        }
        break

      case "lowSkus":
        if (vars.lowSkus?.length) {
          parts.push(<span key={`skus-${keyIndex++}`}>{renderSkuLinks(vars.lowSkus)}</span>)
        }
        break

      case "inactiveSkus":
        if (vars.inactiveSkus?.length) {
          parts.push(<span key={`skus-${keyIndex++}`}>{renderSkuLinks(vars.inactiveSkus)}</span>)
        }
        break

      case "skus":
        if (vars.outSkus?.length) {
          parts.push(<span key={`skus-${keyIndex++}`}>{renderSkuLinks(vars.outSkus)}</span>)
        } else if (vars.lowSkus?.length) {
          parts.push(<span key={`skus-${keyIndex++}`}>{renderSkuLinks(vars.lowSkus)}</span>)
        } else if (vars.inactiveSkus?.length) {
          parts.push(<span key={`skus-${keyIndex++}`}>{renderSkuLinks(vars.inactiveSkus)}</span>)
        }
        break
    }

    lastIndex = regex.lastIndex
  }

  if (lastIndex < template.length) {
    parts.push(<span key={`text-${keyIndex++}`}>{template.slice(lastIndex)}</span>)
  }

  return <>{parts}</>
}

// MESSAGE BUILDER

function buildMessage(data: DashboardSummary, onOpenReceiveForm: () => void): {
  primary: React.ReactNode
  full: React.ReactNode
  canExpand: boolean
} {
  const {
    low_stock,
    out_of_stock,
    fast_mover_low_stock_sku,
    fast_mover_out_of_stock_sku,
    inactive_sku_in_stock,
    empty_inventory,
  } = data

  const vars: MessageVariables = {
    outCount: out_of_stock,
    lowCount: low_stock,
    outSkus: fast_mover_out_of_stock_sku ?? undefined,
    lowSkus: fast_mover_low_stock_sku ?? undefined,
    inactiveSkus: inactive_sku_in_stock ?? undefined,
  }

  // Empty inventory
  if (empty_inventory) {
    const primary = "Your inventory is currently empty."
    const full = (
      <>
        Your inventory is empty. Start by{" "}
        <button
          onClick={onOpenReceiveForm}
          className="text-primary font-medium underline underline-offset-4 transition-colors cursor-pointer"
        >
          receiving your first stock
        </button>
        , or read the{" "}
        <Link
          href="/docs/getting-started"
          className="text-primary font-medium underline underline-offset-4 transition-colors"
        >
          Getting Started Guide
        </Link>{" "}
        to learn more.
      </>
    )
    const canExpand = false
    
    return {
      primary: <span>{canExpand ? primary : full}</span>,
      full,
      canExpand,
    }
  }

  // Healthy inventory
  if (low_stock === 0 && out_of_stock === 0) {
    if (inactive_sku_in_stock?.length) {
      const primaryTemplate = DASHBOARD_MESSAGES.inventory.healthyWithInactive.primary(vars)
      const fullTemplate = DASHBOARD_MESSAGES.inventory.healthyWithInactive.full(vars)
      const canExpand = shouldShowToggle(primaryTemplate, fullTemplate)

      return {
        primary: interpolateMessage(canExpand ? primaryTemplate : fullTemplate, vars),
        full: interpolateMessage(fullTemplate, vars),
        canExpand,
      }
    }

    const { primary, full } = DASHBOARD_MESSAGES.inventory.healthy
    return {
      primary: <span>{primary}</span>,
      full: <span>{full}</span>,
      canExpand: false,
    }
  }

  // Low stock only
  if (low_stock > 0 && out_of_stock === 0) {
    if (fast_mover_low_stock_sku?.length) {
      const primaryTemplate = DASHBOARD_MESSAGES.inventory.lowStockOnly.withFastMovers.primary(vars)
      const fullTemplate = DASHBOARD_MESSAGES.inventory.lowStockOnly.withFastMovers.full(vars)
      const canExpand = shouldShowToggle(primaryTemplate, fullTemplate)

      return {
        primary: interpolateMessage(canExpand ? primaryTemplate : fullTemplate, vars),
        full: interpolateMessage(fullTemplate, vars),
        canExpand,
      }
    }

    const primaryTemplate = DASHBOARD_MESSAGES.inventory.lowStockOnly.generic.primary(vars)
    const fullTemplate = DASHBOARD_MESSAGES.inventory.lowStockOnly.generic.full(vars)
    const canExpand = shouldShowToggle(primaryTemplate, fullTemplate)

    return {
      primary: interpolateMessage(canExpand ? primaryTemplate : fullTemplate, vars),
      full: interpolateMessage(fullTemplate, vars),
      canExpand,
    }
  }

  // Out of stock only
  if (out_of_stock > 0 && low_stock === 0) {
    if (fast_mover_out_of_stock_sku?.length) {
      const primaryTemplate =
        DASHBOARD_MESSAGES.inventory.outOfStockOnly.withFastMovers.primary(vars)
      const fullTemplate = DASHBOARD_MESSAGES.inventory.outOfStockOnly.withFastMovers.full(vars)
      const canExpand = shouldShowToggle(primaryTemplate, fullTemplate)

      return {
        primary: interpolateMessage(canExpand ? primaryTemplate : fullTemplate, vars),
        full: interpolateMessage(fullTemplate, vars),
        canExpand,
      }
    }

    const primaryTemplate = DASHBOARD_MESSAGES.inventory.outOfStockOnly.generic.primary(vars)
    const fullTemplate = DASHBOARD_MESSAGES.inventory.outOfStockOnly.generic.full(vars)
    const canExpand = shouldShowToggle(primaryTemplate, fullTemplate)

    return {
      primary: interpolateMessage(canExpand ? primaryTemplate : fullTemplate, vars),
      full: interpolateMessage(fullTemplate, vars),
      canExpand,
    }
  }

  // Both low and out of stock
  if (low_stock > 0 && out_of_stock > 0) {
    const primaryTemplate = DASHBOARD_MESSAGES.inventory.bothStockIssues.primary(vars)
    const fullTemplate = DASHBOARD_MESSAGES.inventory.bothStockIssues.full(vars)
    const canExpand = shouldShowToggle(primaryTemplate, fullTemplate)

    return {
      primary: interpolateMessage(canExpand ? primaryTemplate : fullTemplate, vars),
      full: interpolateMessage(fullTemplate, vars),
      canExpand,
    }
  }

  // Fallback
  const { primary, full } = DASHBOARD_MESSAGES.inventory.fallback
  return {
    primary: <span>{primary}</span>,
    full: <span>{full}</span>,
    canExpand: false,
  }
}

// MAIN COMPONENT

export default function DashboardHeader({ data, selectedLocation, onTabChange }: Props) {
  const [expandedMessage, setExpandedMessage] = useState(false)
  const [isReceiveFormOpen, setIsReceiveFormOpen] = useState(false)

  const { first_name, locations } = data

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return DASHBOARD_MESSAGES.greetings.morning
    if (hour < 18) return DASHBOARD_MESSAGES.greetings.afternoon
    return DASHBOARD_MESSAGES.greetings.evening
  }, [])

  const message = useMemo(
    () => buildMessage(data, () => setIsReceiveFormOpen(true)),
    [data]
  )

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
              {expandedMessage
                ? DASHBOARD_MESSAGES.actions.showLess
                : DASHBOARD_MESSAGES.actions.showMore}
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
              {DASHBOARD_MESSAGES.tabs.allLocations}
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
      <ReceiveForm
        open={isReceiveFormOpen}
        onOpenChange={setIsReceiveFormOpen}
        invalidateQueries={["inventory", "transactions", "trend", "valuation", "search", "skus"]}
      />
    </div>
  )
}

// SKELETON
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
