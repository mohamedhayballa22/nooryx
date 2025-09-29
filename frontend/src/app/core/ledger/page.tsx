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

const items = [
  {
    id: 1,
    date: "Nov 7, 2024 at 10:35 AM",
    actor: "Hannah Kandell",
    action: "added",
    quantity: 21,
    sku_id: "IPHONE-15-BLK",
    location: "Warehouse X68",
    stock_before: 50,
    stock_after: 71,
    metadata: { batch_id: "BATCH-001", supplier: "Apple Inc." },
  },
  {
    id: 2,
    date: "Jan 2, 2025 at 10:02 AM",
    actor: "Chris Tompson",
    action: "shipped",
    quantity: 1,
    sku_id: "BAT-178X-2014",
    location: "Warehouse Z2",
    stock_before: 10,
    stock_after: 9,
    metadata: null,
  },
  {
    id: 3,
    date: "Feb 23, 2025 at 11:58 AM",
    actor: "Emma Davis",
    action: "reserved",
    quantity: 3,
    sku_id: "CHAR-20IN",
    location: "Warehouse BB658",
    stock_before: 30,
    stock_after: 27,
    metadata: { order_id: "ORD-9099" },
  },
  {
    id: 10,
    date: "Feb 23, 2025 at 11:58 AM",
    actor: "Mohamed Hayballa",
    action: "unreserved",
    quantity: 3,
    sku_id: "CHAR-20IN",
    location: "Warehouse BB658",
    stock_before: 30,
    stock_after: 33,
    metadata: null,
  },
  {
    id: 4,
    date: "Mar 17, 2025 at 08:18 AM",
    actor: "Alex Morgan",
    action: "transferred",
    quantity: 1,
    sku_id: "IPHONE-15-BLK",
    from_location: "Warehouse X68",
    to_location: "Warehouse Z2",
    stock_before: 20,
    stock_after: 19,
    metadata: { transfer_id: "TX-555" },
  },
  {
    id: 5,
    date: "Apr 4, 2025 at 02:15 PM",
    actor: "Laura Smith",
    action: "adjusted",
    quantity: 2,
    sku_id: "MON-24HD",
    location: "Warehouse A1",
    stock_before: 15,
    stock_after: 13,
    metadata: { reason: "Inventory correction" },
  },
]

const actionIcons: Record<string, any> = {
  added: ListPlus,
  shipped: SendHorizonal,
  reserved: Tag,
  transferred: ArrowDownUp,
  adjusted: SlidersHorizontal,
  unreserved: ClipboardMinus,
}

export default function LedgerComponent() {
  const isMobile = useMobile()

  return (
    <Timeline defaultValue={0} className="pt-10 pl-10">
      {items.map((item) => {
        const plural = item.quantity > 1
        const itemWord = plural ? "items" : "item"
        const verb = plural ? "were" : "was"

        // Timeline header
        const headerText = (
          <>
            <span className="font-bold">{item.actor}</span> {item.action} {plural ? "items" : "an item"}
          </>
        )

        // Overview text
        let overviewText = ""
        if (item.action === "transferred") {
          overviewText = `${item.quantity} ${itemWord} ${verb} transferred from ${item.from_location} to ${item.to_location}`
        } else if (item.action === "adjusted") {
          const sign = item.stock_after > item.stock_before ? "+" : "-"
          overviewText = `${sign}${item.quantity} ${itemWord} at ${item.location}`
        } else {
          overviewText = `${item.quantity} ${itemWord} ${verb} ${item.action} at ${item.location}`
        }

        const Icon = actionIcons[item.action] || Tag

        const mobileContent = (
          <div className="space-y-3 text-sm text-muted-foreground">
            {/* Overview content */}
            <div>{overviewText}</div>

            {/* Metadata content */}
            {item.metadata && (
              <div>
                <ul className="space-y-1">
                  {Object.entries(item.metadata).map(([key, value]) => (
                    <li key={key}>
                      <span className="font-semibold capitalize">{key.replace(/_/g, " ")}:</span> {value}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Context content */}
            <div className="flex flex-col gap-2">
              <a
                href={`/sku/${item.sku_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md bg-muted hover:bg-muted/70 transition-colors w-fit"
              >
                {item.sku_id}
                <ExternalLink size={14} className="opacity-70" />
              </a>

              <div className="flex items-center gap-1 text-sm">
                <span>Quantity: {item.stock_before}</span>
                <ArrowRight size={14} className="text-muted-foreground" />
                <span>{item.stock_after}</span>
              </div>
            </div>
          </div>
        )

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
                        {/* Date always visible under header */}
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


        // Desktop version with hover tabs (unchanged)
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
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview" className="text-xs">
                      <BookOpen /> Overview
                    </TabsTrigger>
                    <TabsTrigger value="metadata" className="text-xs" disabled={!item.metadata}>
                      <Tag /> Metadata
                    </TabsTrigger>
                    <TabsTrigger value="context" className="text-xs">
                      <Crosshair /> Context
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="overview" className="text-sm">
                  {overviewText}
                </TabsContent>
                <TabsContent value="metadata" className="text-sm">
                  {item.metadata ? (
                    <ul className="space-y-1">
                      {Object.entries(item.metadata).map(([key, value]) => (
                        <li key={key}>
                          <span className="font-semibold capitalize">{key.replace(/_/g, " ")}:</span> {value}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-muted-foreground">No metadata available</span>
                  )}
                </TabsContent>
                <TabsContent value="context" className="text-sm">
                  <div className="flex flex-col gap-2">
                    {/* SKU link */}
                    <a
                      href={`/sku/${item.sku_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded-md bg-muted hover:bg-muted/70 transition-colors w-fit"
                    >
                      {item.sku_id}
                      <ExternalLink size={14} className="opacity-70" />
                    </a>

                    <div className="flex items-center gap-1 text-sm">
                      <span>Quantity: {item.stock_before}</span>
                      <ArrowRight size={14} className="text-muted-foreground" />
                      <span>{item.stock_after}</span>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <TimelineDate className="mt-2 mb-0">{item.date}</TimelineDate>
            </TimelineContent>
          </TimelineItem>
        )
      })}
    </Timeline>
  )
}
