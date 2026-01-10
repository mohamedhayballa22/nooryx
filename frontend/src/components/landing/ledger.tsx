"use client";

import { 
  DeliveryTruck, 
  BoxIso, 
  User,
  Wind,
  Eye
} from "iconoir-react";
import { 
  Lock, 
  Edit,
  ArrowLeftRight,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NooryxFontBold } from '@/app/fonts/typeface';
import { useState, useEffect } from 'react';

const STATIC_TRANSACTIONS = [
  {
    id: "evt_1",
    action: "shipped",
    sku: "TSHIRT-BLK-M",
    location: "Main Warehouse",
    actor: "Sarah Kandell",
    qty_before: 85,
    qty_after: 83,
    quantity: 3,
    time: "10:42 AM",
  },
  {
    id: "evt_2",
    action: "received",
    sku: "TSHIRT-BLK-M",
    location: "Main Warehouse",
    actor: "Adrian Cole",
    qty_before: 35,
    qty_after: 85,
    quantity: 50,
    time: "09:15 AM",
  },
  {
    id: "evt_3",
    action: "adjusted",
    sku: "TSHIRT-BLK-M",
    location: "Main Warehouse",
    actor: "Elena Morales",
    qty_before: 40,
    qty_after: 35,
    quantity: -5,
    time: "08:33 AM",
  },
  {
    id: "evt_4",
    action: "shipped",
    sku: "TSHIRT-BLK-M",
    location: "Main Warehouse",
    actor: "Sarah Kandell",
    qty_before: 45,
    qty_after: 40,
    quantity: -5,
    time: "07:21 AM",
  },
  {
    id: "evt_5",
    action: "received",
    sku: "TSHIRT-BLK-M",
    location: "Main Warehouse",
    actor: "Dock Team",
    qty_before: 0,
    qty_after: 45,
    quantity: 45,
    time: "06:05 AM",
  },
];

const StaticTransactionRow = ({ item, isLast }: { item: typeof STATIC_TRANSACTIONS[0], isLast: boolean }) => {
  let Icon = BoxIso;
  let label = "Update";
  
  switch(item.action) {
    case 'received': 
        Icon = BoxIso; 
        label = "Received";
        break;
    case 'shipped': 
        Icon = DeliveryTruck; 
        label = "Shipped"; 
        break;
    case 'reserved': 
        Icon = Lock; 
        label = "Reserved"; 
        break;
    case 'adjusted': 
        Icon = Edit; 
        label = "Adjusted";
        break;
    case 'transferred': 
        Icon = ArrowLeftRight; 
        label = "Transfer"; 
        break;
  }

  const isReservation = item.action === "reserved" || item.action === "unreserved";
  
  const delta = isReservation 
    ? (item.action === "reserved" ? -item.quantity : item.quantity)
    : item.qty_after - item.qty_before;

  const isPositive = delta > 0;
  const isNeutral = delta === 0;

  return (
    <div className="flex gap-2 sm:gap-4 relative group">
      <div className="w-10 sm:w-14 pt-[9px] flex flex-col items-end shrink-0">
        <span className="font-mono text-[10px] sm:text-xs text-muted-foreground/40 leading-none">
          {item.time}
        </span>
      </div>

      <div className="relative flex flex-col items-center">
        <div className={cn(
            "absolute w-0.5 bg-border top-0",
            isLast ? "h-4" : "bottom-0"
        )} />
        
        <div className="relative z-10 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background">
          <Icon strokeWidth={1.5} width={12} height={12} className="sm:w-[14px] sm:h-[14px] text-muted-foreground/70" />
        </div>
      </div>

      <div className={cn("flex-1 min-w-0", !isLast && "pb-4 sm:pb-6")}>
        <div className="flex items-start justify-between gap-2 sm:gap-4 px-2 pt-1.5 pb-2 -ml-2 rounded-md">
            
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-xs sm:text-sm font-medium text-foreground">{label}</span>
                <span className="text-[10px] text-muted-foreground/40">•</span>
                <span className="inline-flex items-center rounded-sm bg-muted/50 px-1.5 py-0.5 font-mono text-[10px] sm:text-xs text-foreground/80">
                  {item.sku}
                </span>
              </div>
              
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                  <User className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-muted-foreground/70" />
                  <span className="text-[10px] sm:text-xs text-muted-foreground/70 truncate">{item.actor}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/40">•</span>
                <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-muted-foreground/50">
                  <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0" />
                  <span className="truncate">{item.location}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-0.5 shrink-0 min-w-[60px]">
              <span
                className={cn(
                  "font-mono text-xs sm:text-sm font-medium tracking-tight tabular-nums",
                  isPositive && "text-emerald-600 dark:text-emerald-500",
                  delta < 0 && "text-red-600 dark:text-red-500",
                  isNeutral && "text-muted-foreground"
                )}
              >
                {isPositive ? "+" : ""}{delta === 0 ? "-" : delta}
              </span>

              {isReservation && (
                <span className="text-[9px] sm:text-[10px] text-muted-foreground/30 font-medium text-right">
                  No change to on-hand
                </span>
              )}
            </div>
          </div>
      </div>
    </div>
  );
};

export default function TrustIndicatorSection() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const displayedTransactions = isMobile 
    ? STATIC_TRANSACTIONS.slice(0, 3) 
    : STATIC_TRANSACTIONS;

  return (
    <section className="pb-16 sm:pb-24 relative">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 sm:gap-16 lg:gap-24 items-start">
          
          <div className="flex flex-col gap-4 sm:gap-6 max-w-xl">
            <h2 className={`${NooryxFontBold.className} text-2xl sm:text-3xl md:text-4xl text-pretty leading-tight`}>
              Real inventory truth.<br/>
              <span className="text-foreground/65">In real time. </span>
            </h2>
            
            <div className="space-y-3 sm:space-y-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
              <p>
                See what changed, when it changed, and who made the change, instantly and in context.
              </p>
              <p>
                Nooryx gives teams a reliable view of inventory across products and locations, so decisions can be made without second-guessing.
              </p>
            </div>

            <div className="pt-2">
              <div className="inline-flex items-center gap-0 rounded-full border border-border/60 bg-background/50 py-1.5 pl-2.5 sm:pl-3 pr-2.5 sm:pr-3 backdrop-blur-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
                
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Wind className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-foreground/70" strokeWidth={2} />
                  <span className="font-mono text-xs sm:text-sm font-medium tracking-tight text-foreground">
                    &lt; 100ms
                  </span>
                </div>

                <div className="mx-2 sm:mx-3 h-3 w-[1px] bg-border" />

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Eye className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-foreground/70" strokeWidth={2} />
                  <span className="font-mono text-xs sm:text-sm font-medium tracking-tight text-foreground">
                    24/7
                  </span>
                </div>

              </div>
            </div>
          </div>

          <div className="relative">
             
            <div className="relative rounded-lg sm:rounded-xl md:rounded-2xl bg-gradient-to-br from-black/15 via-black/8 to-transparent dark:from-white/20 dark:via-white/5 dark:to-transparent p-[1px]">
                
                <div className="relative rounded-[9px] sm:rounded-[11px] md:rounded-[15px] bg-background overflow-hidden h-full">
                    
                    <div className="p-4 sm:p-6 md:p-8">
                        <div className="flex flex-col">
                            {displayedTransactions.map((item, i) => (
                                <StaticTransactionRow 
                                    key={item.id} 
                                    item={item} 
                                    isLast={i === displayedTransactions.length - 1} 
                                />
                            ))}
                        </div>
                    </div>

                </div>
            </div>
            <div className="absolute inset-0 z-40 pointer-events-none rounded-lg sm:rounded-xl md:rounded-2xl bg-gradient-to-t from-background via-background/90 via-20% to-transparent to-60%" />

          </div>

        </div>
      </div>
    </section>
  );
}
