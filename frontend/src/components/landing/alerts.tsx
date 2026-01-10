"use client";

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { NooryxFontBold } from '@/app/fonts/typeface';
import Image from 'next/image';

// MOCKED DATA
const DEMO_ALERT = {
  id: "alert_demo_1",
  title: "1 SKU needs reordering",
  message: "Hex Bolt M12×10 STL is below reorder point",
  severity: "warning",
  is_read: false,
  metadata: {
    details: [
      {
        sku_code: "BLT-M12-10-STL",
        sku_name: "Hex Bolt M12×10 STL",
        available: 12,
        reorder_point: 15
      }
    ]
  }
};

// PRESENTATIONAL COMPONENT
const LandingAlertCard = () => {
  const [expanded, setExpanded] = useState(true);
  
  const severityStyles = {
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-500/30',
  };

  return (
    <div className="w-[300px] sm:w-[340px] rounded-[12px]">
      <div className="relative rounded-[12px] bg-gradient-to-br from-black/15 via-black/8 to-transparent dark:from-white/20 dark:via-white/5 dark:to-transparent p-[1px]">  
        <div className="relative rounded-[11px] bg-background overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="cursor-pointer w-full px-4 py-3.5 text-left hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`h-5 w-1.5 rounded-full flex-shrink-0 ${severityStyles.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-medium text-sm text-foreground">
                      {DEMO_ALERT.title}
                    </h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] uppercase tracking-wide font-semibold border ${severityStyles.badge}`}>
                      {DEMO_ALERT.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                    {DEMO_ALERT.message}
                  </p>
                </div>
              </div>
              <ChevronDown
                size={16}
                className={`text-muted-foreground transition-transform flex-shrink-0 mt-0.5 ${
                  expanded ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {expanded && (
            <div className="border-t border-border px-4 py-3 space-y-3 bg-background/50">
              <div className="space-y-2">
                {DEMO_ALERT.metadata.details.map((detail) => (
                  <div
                    key={detail.sku_code}
                    className="rounded-lg bg-muted/40 p-3 flex items-center justify-between text-sm border border-border/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground text-sm">
                        {detail.sku_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                        {detail.sku_code}
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <p className="font-medium text-foreground text-sm tabular-nums">
                        Avail: {detail.available}
                      </p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        Reorder: {detail.reorder_point}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] text-muted-foreground tracking-wider font-medium">
                  Just now
                </p>
                <span className="text-[10px] font-medium text-primary cursor-pointer hover:opacity-80 transition-opacity">
                  Mark as read
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default function AlertsSection() {
  return (
    <section className="py-12 sm:py-24 relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6">
        
        <div className="relative w-full max-w-6xl mx-auto">
            
          <div className="relative z-20 mb-8 lg:mb-0 lg:absolute lg:bottom-1 lg:left-0 lg:max-w-xl lg:text-left pointer-events-none">
            <div className="pointer-events-auto">
              <span className="text-[10px] sm:text-xs font-light tracking-[0.2em] text-muted-foreground/90 uppercase mb-2 block">
                Alerts
              </span>
              <h2 className={`${NooryxFontBold.className} text-3xl sm:text-4xl text-pretty leading-[1.1] mb-4`}>
                Less stress, <br/>
                <span className="text-foreground/65">fewer surprises.</span>
              </h2>
              <p className="text-base text-muted-foreground leading-relaxed">
                Set your own thresholds per product, turn alerts on or off by SKU, 
                and get notified when it matters, with enough time to act. 
                Nooryx tracks stock health continuously so you can focus on growth.
              </p>
            </div>
          </div>

          <div className="relative z-10 w-full select-none">
            
            {/* Dark mode image */}
            <div className="hidden dark:block">
              <Image
                src="/ui/alerts-graph-dark.avif"
                alt="Inventory levels dipping below threshold"
                width={1200}
                height={600}
                quality={90}
                className="w-full h-auto object-contain opacity-90 dark:opacity-80"
                draggable="false"
                priority
              />
            </div>

            {/* Light mode image */}
            <div className="dark:hidden">
              <Image 
                src="/ui/alerts-graph-light.avif"
                alt="Inventory levels dipping below threshold"
                width={1200}
                height={600}
                quality={90}
                className="w-full h-auto object-contain opacity-90"
                draggable="false"
                priority
              />
            </div>

            <div className="absolute top-0 right-0 sm:-top-8 sm:-right-8 lg:top-8 lg:right-16 z-30 
                            origin-top-right transform transition-transform duration-300
                            scale-[0.55] 
                            min-[450px]:scale-[0.75]
                            sm:scale-[0.85] 
                            md:scale-100">
              <LandingAlertCard />
            </div>

          </div>

        </div>
      </div>
    </section>
  );
}
