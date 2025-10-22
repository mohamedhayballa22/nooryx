"use client"

import {
  ArrowDownUp,
  ListPlus,
  SendHorizonal,
  Tag,
  BookOpen,
  Crosshair,
  ArrowRight,
  ExternalLink,
  ClipboardMinus,
  SlidersHorizontal,
} from "lucide-react"

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
import React from "react"

import { TransactionItem } from "@/lib/api/inventory"
import { Skeleton } from "@/components/ui/skeleton"

export function AuditTrail({
  items,
  snippet = false,
}: {
  items: TransactionItem[]
  snippet?: boolean
}) {
  const isMobile = useMobile()

  const actionIcons: Record<string, any> = {
    added: ListPlus,
    shipped: SendHorizonal,
    reserved: Tag,
    transferred: ArrowDownUp,
    adjusted: SlidersHorizontal,
    unreserved: ClipboardMinus,
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
          overviewText = `${item.quantity} ${itemWord} ${verb} transferred into ${item.location}`
        } else if (item.action === "transferred out") {
          overviewText = `${item.quantity} ${itemWord} ${verb} transferred out of ${item.location}`
        } else if (item.action === "adjusted") {
          const sign = item.qty_after > item.qty_before ? "+" : "-"
          overviewText = `${sign}${item.quantity} ${itemWord} at ${item.location}`
        } else {
          overviewText = `${item.quantity} ${itemWord} ${verb} ${item.action} at ${item.location}`
        }

        const Icon = actionIcons[item.action] || Tag

        const quantityLine = (
          <div className="flex items-center gap-1 text-sm mt-1">
            <span>
              Quantity at {item.location}: {item.qty_before}
            </span>
            <ArrowRight size={14} className="text-muted-foreground" />
            <span>{item.qty_after}</span>
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
                      {String(value)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Context content (only if not snippet) */}
            {!snippet && (
              <div className="flex flex-col gap-2">
                <a
                  href={`/core/inventory/${item.sku_code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md bg-muted hover:bg-muted/70 transition-colors w-fit"
                >
                  {item.sku_code}
                  <ExternalLink size={14} className="opacity-70" />
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
                        <TimelineDate className="text-xs text-muted-foreground pt-1">{item.date}</TimelineDate>
                      </div>
                      <TimelineIndicator className="border border-primary/10 group-data-completed/timeline-item:border-primary group-data-completed/timeline-item:text-primary-foreground flex size-7 items-center justify-center group-data-[orientation=vertical]/timeline:-left-7">
                        <Icon size={14} />
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
                <Icon size={14} />
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
                      <BookOpen /> Overview
                    </TabsTrigger>
                    <TabsTrigger value="metadata" className="text-xs" disabled={!item.metadata}>
                      <Tag /> Metadata
                    </TabsTrigger>
                    {!snippet && (
                      <TabsTrigger value="context" className="text-xs">
                        <Crosshair /> Context
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
                          {String(value)}
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
                        href={`/core/inventory/${item.sku_code}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md bg-muted hover:bg-muted/70 transition-colors w-fit"
                      >
                        {item.sku_code}
                        <ExternalLink size={14} className="opacity-70" />
                      </a>

                      {quantityLine}
                    </div>
                  </TabsContent>
                )}
              </Tabs>

              <TimelineDate className="mt-2 mb-0">{item.date}</TimelineDate>
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
