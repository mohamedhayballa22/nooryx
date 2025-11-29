"use client"

import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/ui/timeline"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { useMobile } from "@/hooks/use-mobile"
import { useFormatting } from "@/hooks/use-formatting"

import { TransactionItem } from "@/lib/api/inventory"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  BoxIso, DeliveryTruck, Edit, Upload, 
  OpenBook, InfoCircle, OpenNewWindow, 
  ArrowRight, Puzzle } from "iconoir-react"
import { Lock, Unlock } from "lucide-react"

export function AuditTrail({
  items,
  snippet = false,
}: {
  items: TransactionItem[]
  snippet?: boolean
}) {
  const isMobile = useMobile()
  const { formatDate, formatCurrency, formatQuantity } = useFormatting()

  const actionIcons: Record<string, any> = {
    added: BoxIso,
    shipped: DeliveryTruck,
    reserved: (props: any) => <Lock {...props} strokeWidth={1.5} />,
    adjusted: Edit,
    unreserved: (props: any) => <Unlock {...props} strokeWidth={1.5} />,
    "transferred in": Upload,
    "transferred out": Upload,
  }

  const formatMetadataValue = (key: string, value: any): string => {
    if (key === "transfer_cost_per_unit" && typeof value === "number") {
      return formatCurrency(value)
    }
    return String(value)
  }

  if (items.length === 0) {
    return (
      <div className="py-5 text-center">
        No results found.
      </div>
    )
  }

  return (
    <Timeline defaultValue={0}>
      {items.map((item) => {
        const plural = item.quantity > 1
        const itemWord = plural ? "items" : "item"
        const verb = plural ? "were" : "was"

        const headerText = (
          <>
            <span className="font-bold">{item.actor}</span> {item.action} {plural ? "items" : "an item"}
          </>
        )

        // Overview text base
        let overviewText = ""
        if (item.action === "transferred in") {
          overviewText = `${formatQuantity(item.quantity)} ${itemWord} ${verb} transferred into ${item.location}`
        } else if (item.action === "transferred out") {
          overviewText = `${formatQuantity(item.quantity)} ${itemWord} ${verb} transferred out of ${item.location}`
        } else if (item.action === "adjusted") {
          const sign = item.qty_after > item.qty_before ? "+" : "-"
          overviewText = `${sign}${formatQuantity(item.quantity)} ${itemWord} at ${item.location}`
        } else {
          overviewText = `${formatQuantity(item.quantity)} ${itemWord} ${verb} ${item.action} at ${item.location}`
        }

        const Icon = actionIcons[item.action] || OpenBook

        const quantityLine = (
          <div className="flex items-center gap-1 text-sm mt-1">
            <span>
              Quantity at {item.location}: {formatQuantity(item.qty_before)}
            </span>
            <ArrowRight width={14} height={14} className="text-muted-foreground" />
            <span>{formatQuantity(item.qty_after)}</span>
          </div>
        )

        const mobileContent = (
          <div className="space-y-3 text-sm text-muted-foreground">
            {/* Overview content */}
            <div className="whitespace-pre-line">
              {overviewText}
              {snippet && quantityLine}
            </div>

            {/* Metadata content */}
            {item.metadata && (
              <div>
                <ul className="space-y-1">
                  {Object.entries(item.metadata).map(([key, value]) => (
                    <li key={key}>
                      <span className="font-semibold capitalize">{key.replace(/_/g, " ")}:</span>{" "}
                      {formatMetadataValue(key, value)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Context content (only if not snippet) */}
            {!snippet && (
              <div className="flex flex-col gap-2">
                <a
                  href={`/core/inventory?sku=${encodeURIComponent(item.sku_code)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md bg-muted hover:bg-muted/70 transition-colors w-fit"
                >
                  {item.sku_code}
                  <OpenNewWindow width={14} height={14} className="opacity-70" />
                </a>

                {quantityLine}
              </div>
            )}
          </div>
        )

        // Mobile version
        if (isMobile) {
          return (
            <TimelineItem
              key={item.id}
              step={item.id}
              className="group relative group-data-[orientation=vertical]/timeline:ms-10"
            >
              <Accordion type="single" collapsible className="w-[300px]">
                <AccordionItem value={`item-${item.id}`} className="border-none">
                  <AccordionTrigger className="hover:no-underline p-0">
                    <TimelineHeader className="w-full pb-1">
                      <TimelineSeparator className="group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=vertical]/timeline:translate-y-7" />
                      <div className="flex flex-col">
                        <TimelineTitle className="mt-0.5">{headerText}</TimelineTitle>
                        <TimelineDate className="text-xs text-muted-foreground pt-1">
                          {formatDate(item.date)}
                        </TimelineDate>
                      </div>
                      <TimelineIndicator className="border border-primary/10 group-data-completed/timeline-item:border-primary group-data-completed/timeline-item:text-primary-foreground flex size-7 items-center justify-center group-data-[orientation=vertical]/timeline:-left-7">
                        <Icon
                          width={18}
                          height={18}
                          className={item.action === "transferred in" ? "rotate-180" : ""}
                        />
                      </TimelineIndicator>
                    </TimelineHeader>
                  </AccordionTrigger>
                  <AccordionContent>
                    <TimelineContent>{mobileContent}</TimelineContent>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TimelineItem>
          )
        }

        // Desktop version
        return (
          <TimelineItem
            key={item.id}
            step={item.id}
            className="group relative group-data-[orientation=vertical]/timeline:ms-10 w-fit"
          >
            <TimelineHeader>
              <TimelineSeparator className="group-data-[orientation=vertical]/timeline:-left-7 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.5rem-0.25rem)] group-data-[orientation=vertical]/timeline:translate-y-7" />
              <TimelineTitle className="mt-0.5">{headerText}</TimelineTitle>
              <TimelineIndicator className="border border-primary/10 group-data-completed/timeline-item:border-primary group-data-completed/timeline-item:text-primary-foreground flex size-7 items-center justify-center group-data-[orientation=vertical]/timeline:-left-7">
                <Icon
                  width={18}
                  height={18}
                  className={item.action === "transferred in" ? "rotate-180" : ""}
                />
              </TimelineIndicator>
            </TimelineHeader>

            <TimelineContent>
              <Tabs defaultValue="overview" className="w-[290px] text-sm text-muted-foreground">
                <div
                  className="
                    max-h-0 overflow-hidden opacity-0
                    group-hover:max-h-40 group-hover:opacity-100
                    transition-all duration-300 ease-in-out
                    group-hover:pt-2
                  "
                >
                  <TabsList
                    className={`grid w-full ${snippet ? "grid-cols-2" : "grid-cols-3"}`}
                  >
                    <TabsTrigger value="overview" className="text-xs">
                      <OpenBook /> Overview
                    </TabsTrigger>
                    <TabsTrigger value="metadata" className="text-xs" disabled={!item.metadata}>
                      <InfoCircle /> Metadata
                    </TabsTrigger>
                    {!snippet && (
                      <TabsTrigger value="context" className="text-xs">
                        <Puzzle /> Context
                      </TabsTrigger>
                    )}
                  </TabsList>
                </div>

                <TabsContent value="overview" className="text-sm whitespace-pre-line">
                  <div>
                    {overviewText}
                    {snippet && quantityLine}
                  </div>
                </TabsContent>

                <TabsContent value="metadata" className="text-sm">
                  {item.metadata ? (
                    <ul className="space-y-1">
                      {Object.entries(item.metadata).map(([key, value]) => (
                        <li key={key}>
                          <span className="font-semibold capitalize">{key.replace(/_/g, " ")}:</span>{" "}
                          {formatMetadataValue(key, value)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">No metadata available</span>
                  )}
                </TabsContent>

                {!snippet && (
                  <TabsContent value="context" className="text-sm">
                    <div className="flex flex-col gap-2">
                      <a
                        href={`/core/inventory?sku=${encodeURIComponent(item.sku_code)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md bg-muted hover:bg-muted/70 transition-colors w-fit"
                      >
                        {item.sku_code}
                        <OpenNewWindow width={14} height={14} className="opacity-70" />
                      </a>

                      {quantityLine}
                    </div>
                  </TabsContent>
                )}
              </Tabs>

              <TimelineDate className="mt-2 mb-0">{formatDate(item.date)}</TimelineDate>
            </TimelineContent>
          </TimelineItem>
        )
      })}
    </Timeline>
  )
}

export function AuditTrailSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={`sk-${i}`} className="flex items-start gap-4">
          <div className="flex flex-col items-center">
            <div className="h-7 w-7 rounded-full bg-muted/60 animate-pulse" />
            {i < 9 && <div className="h-16 w-[1px] bg-muted/30 mt-2" />}
          </div>
          <div className="flex-1 space-y-2 pt-1">
            <Skeleton className="h-4 w-64 rounded" />
            <Skeleton className="h-3 w-48 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

AuditTrail.Skeleton = AuditTrailSkeleton;
