"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { 
  DeliveryTruck, 
  Edit, 
  User,
  Coins ,
  BoxIso
} from "iconoir-react";
import { 
  Lock,
  Unlock, 
  ArrowLeftRight, 
  Bot,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TransactionItem } from "@/lib/api/inventory";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormatting } from "@/hooks/use-formatting";

interface AuditTrailProps {
  items: TransactionItem[];
  isLoading?: boolean;
  snippet?: boolean;
}

const ACTION_CONFIG: Record<string, {
  icon: React.ElementType;
  label: string;
}> = {
  received: { 
    icon: (props: any) => <BoxIso {...props} strokeWidth={2} />, 
   label: "Received" 
  },
  shipped: { 
    icon: (props: any) => <DeliveryTruck {...props} strokeWidth={2} />, 
    label: "Shipped" 
  },
  reserved: { icon: Lock, label: "Reserved" },
  unreserved: { icon: Unlock, label: "Unreserved" },
  adjusted: { 
    icon: (props: any) => <Edit {...props} strokeWidth={2} />, 
    label: "Adjusted" 
  },
  "transferred in": { icon: ArrowLeftRight, label: "Transfer In" },
  "transferred out": { icon: ArrowLeftRight, label: "Transfer Out" },
};

const QuantityBadge = ({ 
  before, 
  after,
  quantity,
  action,
  formatQuantity 
}: { 
  before: number; 
  after: number;
  quantity: number;
  action: string;
  formatQuantity: (val: number) => string;
}) => {
  const isReservation = action === "reserved" || action === "unreserved";
  
  // For reservations, we use the quantity field directly with custom logic
  // For others, we calculate the delta from before/after
  const delta = isReservation 
    ? (action === "reserved" ? -quantity : quantity)
    : after - before;

  const isNeutral = delta === 0;
  const isPositive = delta > 0;

  return (
    <div className="flex flex-col items-end gap-0.5 min-w-[60px]">
      <span
        className={cn(
          "font-mono text-sm font-semibold tracking-tight tabular-nums",
          isPositive && "text-emerald-600 dark:text-emerald-500",
          delta < 0 && "text-red-600 dark:text-red-500",
          isNeutral && "text-muted-foreground"
        )}
      >
        {isPositive ? "+" : ""}{formatQuantity(delta)}
      </span>
    </div>
  );
};

const TransactionRow = ({ 
  item, 
  isLastGlobal,
  isLastInGroup,
  isSingleItemInGroup,
  formatDate,
  formatCurrency,
  formatQuantity,
  formatTime,
  snippet = false
}: { 
  item: TransactionItem; 
  isLastGlobal: boolean;
  isLastInGroup: boolean;
  isSingleItemInGroup: boolean;
  formatDate: (date: string | Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatCurrency: (val: number) => string;
  formatQuantity: (val: number) => string;
  formatTime: (val: string | Date | number) => string;
  snippet?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const config = ACTION_CONFIG[item.action] || { icon: BoxIso, label: item.action };
  const Icon = config.icon;

  const metadataEntries = item.metadata 
    ? Object.entries(item.metadata).filter(([k]) => k !== "transfer_cost_per_unit" && k !== "created_by")
    : [];
  
  const hasMetadata = metadataEntries.length > 0;
  const delta = item.qty_after - item.qty_before;
  
  const shouldShowCost = item.unit_cost_major != null && (
    item.action === "received" || 
    (item.action === "adjusted" && delta > 0)
  );

  const dateObj = new Date(item.date);
  const now = new Date();
  const isToday = dateObj.toDateString() === now.toDateString();
  const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === dateObj.toDateString();
  
  const shortDate = formatDate(dateObj, { month: 'short', day: 'numeric' });

  return (
    <div className="group flex gap-3 sm:gap-4 relative">
      <div 
        className={cn(
          "shrink-0 flex-col items-end pt-2.5",
          snippet ? "flex w-14 mr-1" : "hidden w-15 sm:flex"
        )}
      >
        <span className="font-mono text-xs text-muted-foreground/50 whitespace-nowrap leading-none">
          {formatTime(item.date)}
        </span>
        
        {snippet && !isToday && (
          <span className="text-[10px] text-muted-foreground/40 font-medium mt-1 leading-tight whitespace-nowrap">
            {isYesterday ? "Yesterday" : shortDate}
          </span>
        )}
      </div>

      <div className="relative flex flex-col items-center">
        <div 
          className={cn(
            "absolute w-px bg-border/60 top-0",
            isSingleItemInGroup ? "hidden" 
            : isLastInGroup ? "h-4" 
            : "bottom-0",
            isLastGlobal 
              ? "sm:block sm:h-4 sm:bottom-auto" 
              : isLastInGroup 
                ? "sm:block sm:h-auto sm:-bottom-8" 
                : "sm:block sm:h-auto sm:bottom-0"
          )} 
        />
        
        <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors group-hover:border-foreground/30">
          <Icon 
            strokeWidth={1.5} 
            width={14} 
            height={14} 
            className={cn(
              "text-muted-foreground transition-colors group-hover:text-foreground",
              item.action === "transferred in" && "rotate-180"
            )} 
          />
        </div>
      </div>

      <div className={cn("flex-1 min-w-0", snippet ? "pb-3" : "pb-4")}>
        <div 
          onClick={() => hasMetadata && setIsOpen(!isOpen)}
          className={cn(
            "flex flex-col gap-3 rounded-lg border border-transparent p-2 transition-all -ml-2 -mt-2",
            hasMetadata && "cursor-pointer hover:bg-muted/40 hover:border-border/40",
            isOpen && "bg-muted/40 border-border/40"
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5 min-w-0">
              
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium text-foreground">
                  {config.label}
                </span>
                
                <Link
                  href={`/core/inventory?sku=${item.sku_code}`}
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center rounded-sm bg-muted/50 px-1.5 py-0.5 font-mono text-xs text-foreground/80 underline sm:no-underline hover:underline hover:text-foreground transition-colors"
                >
                  {item.sku_code}
                </Link>

                <span className="text-[10px] text-muted-foreground/30">•</span>
                
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground/50" />
                  <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                    {item.location}
                  </span>
                </div>

                {shouldShowCost && (
                  <>
                    <span className="text-[10px] text-muted-foreground/30">•</span>
                    <div className="flex items-center gap-1">
                      <Coins className="h-3 w-3 text-muted-foreground/50" />
                      <span className="text-xs text-muted-foreground truncate">
                        {formatCurrency(item.unit_cost_major || 0)}
                      </span>
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground/70">
                {!snippet && (
                  <>
                    <span className="sm:hidden font-mono text-muted-foreground/50">
                      {formatTime(item.date)}
                    </span>
                    <span className="sm:hidden text-muted-foreground/30">•</span>
                  </>
                )}
                
                <div className="flex items-center gap-1.5">
                  <div className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    {item.metadata?.created_by ? (
                      <Bot height={10} width={10} strokeWidth={2} />
                    ) : (
                      <User height={10} width={10} strokeWidth={2} />
                    )}
                  </div>
                  <span>{item.actor}</span>
                </div>

                {!isOpen && hasMetadata && (
                  <>
                    <span className="text-muted-foreground/30">•</span>
                    <span className="text-muted-foreground/40 font-medium transition-colors group-hover:text-muted-foreground/70">
                      Click for details
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <QuantityBadge 
                before={item.qty_before} 
                after={item.qty_after} 
                quantity={item.quantity}
                action={item.action}
                formatQuantity={formatQuantity}
              />
            </div>
          </div>

          {isOpen && hasMetadata && (
            <div className="flex flex-col gap-2 border-t border-border/10 pt-3 text-xs">
              {metadataEntries.map(([k, v]) => {
                const valStr = String(v);
                const displayVal = valStr.charAt(0).toUpperCase() + valStr.slice(1);

                return (
                  <div key={k} className="flex flex-col">
                    <span className="text-[10px] font-medium text-muted-foreground/50 uppercase tracking-wider">
                      {k.replace(/_/g, " ")}
                    </span>
                    <span className="font-mono text-foreground break-all">
                      {displayVal}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DayGroup = ({ 
  date, 
  items,
  totalItemsCount,
  currentIndexBase,
  formatDate,
  formatCurrency,
  formatQuantity,
  formatTime
}: { 
  date: string; 
  items: TransactionItem[];
  totalItemsCount: number;
  currentIndexBase: number;
  formatDate: (date: string | Date | number, options?: Intl.DateTimeFormatOptions) => string;
  formatCurrency: (val: number) => string;
  formatQuantity: (val: number) => string;
  formatTime: (val: string | Date | number) => string;
}) => {
  const isSingleItemInGroup = items.length === 1;

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-[120px_1fr] md:gap-6">
      <div className="md:relative">
        <div className="sticky top-20 z-10 flex items-center gap-2 bg-background/95 py-2 backdrop-blur md:top-4 md:bg-transparent md:backdrop-blur-none">
          <h3 className="font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground md:w-full md:text-right">
            {date}
          </h3>
          <div className="h-px flex-1 bg-border/40 md:hidden" />
        </div>
      </div>

      <div className="min-w-0 pb-8 last:pb-0">
        {items.map((item, index) => {
          const globalIndex = currentIndexBase + index;
          const isLastGlobal = globalIndex === totalItemsCount - 1;
          const isLastInGroup = index === items.length - 1;

          return (
            <TransactionRow 
              key={item.id} 
              item={item} 
              isLastGlobal={isLastGlobal}
              isLastInGroup={isLastInGroup}
              isSingleItemInGroup={isSingleItemInGroup}
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              formatQuantity={formatQuantity}
              formatTime={formatTime}
            />
          );
        })}
      </div>
    </div>
  );
};

export function AuditTrail({ items, isLoading, snippet = false }: AuditTrailProps) {
  const { formatDate, formatCurrency, formatQuantity, formatTime } = useFormatting();

  const groupedItems = useMemo(() => {
    if (snippet) return {};

    const groups: Record<string, TransactionItem[]> = {};
    const getMidnightDate = (d: Date | string) => {
      const date = new Date(d);
      date.setHours(0, 0, 0, 0);
      return date;
    };

    const todayMidnight = getMidnightDate(new Date()).getTime();
    const yesterdayMidnight = getMidnightDate(new Date(Date.now() - 86400000)).getTime();

    items.forEach((item) => {
      const itemMidnightDate = getMidnightDate(item.date);
      const itemMidnightTime = itemMidnightDate.getTime();
      
      let dateKey: string;

      if (itemMidnightTime === todayMidnight) {
        dateKey = "Today";
      } else if (itemMidnightTime === yesterdayMidnight) {
        dateKey = "Yesterday";
      } else {
        dateKey = formatDate(itemMidnightDate);
      }

      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });
    return groups;
  }, [items, formatDate, snippet]);

  if (isLoading) return <AuditTrail.Skeleton />;

  if (items.length === 0) {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border text-center text-muted-foreground",
        snippet ? "h-24 border-dashed" : "h-40"
      )}>
        <p className="text-sm">No activity records found.</p>
      </div>
    );
  }

  if (snippet) {
    return (
      <div className="flex flex-col">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <TransactionRow 
              key={item.id}
              item={item}
              isLastGlobal={isLast}
              isLastInGroup={isLast} 
              isSingleItemInGroup={items.length === 1}
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              formatQuantity={formatQuantity}
              formatTime={formatTime}
              snippet={true}
            />
          );
        })}
      </div>
    );
  }

  let runningIndex = 0;
  return (
    <div className="flex flex-col">
      {Object.entries(groupedItems).map(([date, groupItems]) => {
        const component = (
          <DayGroup 
            key={date} 
            date={date} 
            items={groupItems} 
            totalItemsCount={items.length}
            currentIndexBase={runningIndex}
            formatDate={formatDate}
            formatCurrency={formatCurrency}
            formatQuantity={formatQuantity}
            formatTime={formatTime}
          />
        );
        runningIndex += groupItems.length;
        return component;
      })}
    </div>
  );
}

AuditTrail.Skeleton = function AuditTrailSkeleton() {
  return (
    <div className="space-y-12">
      {[1, 2, 3, 4].map((group) => (
        <div key={group} className="grid grid-cols-1 gap-4 md:grid-cols-[120px_1fr] md:gap-6">
          <div className="flex md:justify-end">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-8">
            {[1, 2, 3].map((row) => (
              <div key={row} className="flex gap-4">
                <Skeleton className="hidden h-3 w-12 sm:block" />
                <div className="relative">
                  <div className="h-8 w-8 rounded-full bg-muted" />
                  <div className="absolute left-1/2 top-8 w-px -translate-x-1/2 bg-muted h-12" />
                </div>
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
