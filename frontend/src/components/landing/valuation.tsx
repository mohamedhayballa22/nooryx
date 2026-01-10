"use client"

import { NooryxFontBold } from "@/app/fonts/typeface"
import { 
  Calculator, 
  Coins, 
  GraphUp, 
  OpenNewWindow,
  Settings,
} from "iconoir-react"
import { ArrowUpRight, ChevronDown } from "lucide-react"
import Link from "next/link"


export default function FinanceSection() {
  return (
    <section className="py-24 relative bg-background">
      <div className="mx-auto max-w-7xl px-6">
        
        {/* Section Header */}
        <div className="flex flex-col items-start gap-6 mb-12 sm:mb-16 max-w-6xl mx-auto">
          <h2 className={`${NooryxFontBold.className} text-3xl sm:text-4xl md:text-5xl text-pretty leading-[1.1]`}>
            Financial precision, <br className="hidden sm:block" />
            <span className="text-foreground/65">down to the cent.</span>
          </h2>
        </div>

        {/* Constrain width to match the Bento Grid from previous section */}
        <div className="relative w-full max-w-6xl mx-auto">
            
          {/* Sharp Grid Container */}
          <div className="bg-border grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px w-full border border-border rounded-md overflow-hidden">
            
            {/* --- TOP LEFT: Valuation Card --- */}
            <div className="col-span-1 md:col-span-2 bg-background p-8 lg:p-10 flex flex-col justify-between min-h-[260px] group">
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground border border-border">
                    FIFO
                  </span>
                  <span className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                    First In, First Out
                  </span>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Total Inventory Value</p>
                  <p className="font-mono text-5xl sm:text-6xl font-bold tracking-tight text-foreground">
                    $612,400<span className="text-muted-foreground/40">.00</span>
                  </p>
                </div>
              </div>

              {/* Breakdown Pills */}
              <div className="flex items-center gap-3 mt-6 text-xs text-muted-foreground">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/50">
                  <span className="font-medium text-foreground">6,427</span>
                  <span>units</span>
                </div>
                <span className="text-muted-foreground/40">•</span>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/50">
                  <span className="font-medium text-foreground">318</span>
                  <span>SKUs</span>
                </div>
                <span className="text-muted-foreground/40">•</span>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-border/50">
                  <span className="font-medium text-foreground">3</span>
                  <span>locations</span>
                </div>
              </div>
            </div>

            {/* --- TOP RIGHT: COGS Card --- */}
            <div className="col-span-1 md:col-span-2 bg-background p-8 lg:p-10 flex flex-col justify-between min-h-[260px] group">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  {/* Period Selector */}
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-background hover:bg-muted/50 transition-colors text-xs font-medium cursor-pointer select-none group-hover:text-foreground">
                    <span>Last 30 Days</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>

                  {/* Delta Badge */}
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-gray-500/10 text-gray-600 dark:text-gray-400 border border-gray-500/20 text-xs font-medium">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    12.5%
                  </span>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Cost of Goods Sold</p>
                  <p className="font-mono text-5xl sm:text-6xl font-bold tracking-tight text-foreground">
                    $148,900<span className="text-muted-foreground/40">.50</span>
                  </p>
                </div>
              </div>

              {/* Static Trend Line Visualization */}
              <div className="mt-8 h-12 w-full flex items-end gap-1 opacity-40">
                {[40, 65, 50, 80, 55, 90, 70, 100, 85, 60, 75, 50, 65, 80, 95].map((h, i) => (
                  <div key={i} className="flex-1 bg-foreground" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>

            {/* --- MIDDLE: Supporting Text --- */}
            <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-background p-8 lg:p-10 flex flex-col md:flex-row items-start md:items-center gap-8">
              <div className="max-w-2xl">
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Accuracy across time
                </h3>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  As stock moves, costs move with it. Nooryx follows that relationship exactly, across time, locations, and valuation methods. It turns raw stock movement into inventory value and COGS you can trust, whether you’re looking at today, last month, or the full lifetime of your inventory.{" "}
                  <Link
                      href="/docs/core-concepts/valuation"
                      className="inline-flex items-center gap-1 underline underline-offset-4 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                      target="_blank"
                      rel="noopener noreferrer"
                  >
                      See how valuation actually works
                      <OpenNewWindow className="w-4 h-4" />
                  </Link>
                </p>
              </div>
              
              {/* Decorative separator */}
              <div className="hidden md:flex h-16 w-px bg-gradient-to-b from-transparent via-border to-transparent mx-auto" />

              <div className="grid grid-cols-2 gap-x-8 gap-y-2 font-mono text-xs text-muted-foreground/70 uppercase tracking-wider shrink-0">
                <div>GAAP-ready</div>
                <div>Audit-ready</div>
                <div>Export-ready</div>
                <div>Multi-Currency</div>
              </div>
            </div>

            {/* --- BOTTOM: 4 Characteristic Features --- */}
            <FeatureBlock 
              icon={Calculator} 
              title="Current Inventory Value" 
              desc="Know exactly what your inventory is worth right now, across all locations and SKUs."
            />
            
            <FeatureBlock 
              icon={Coins} 
              title="Cost of Goods Sold" 
              desc="View COGS for any time range or across the lifetime of your stock."
            />

            <FeatureBlock 
              icon={GraphUp} 
              title="COGS Over Time" 
              desc="See how your COGS have changed over time to help you make better decisions."
            />

            <FeatureBlock 
              icon={Settings} 
              title="Valuation Methods" 
              desc="Built-in support for FIFO, LIFO, and Weighted Average Cost. "
            />

          </div>
        </div>
      </div>
    </section>
  )
}

function FeatureBlock({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="col-span-1 bg-background p-8 flex flex-col gap-4 group">
      <div className="h-10 w-10 flex items-center justify-center rounded border border-border bg-muted/20 text-foreground">
        <Icon className="w-5 h-5" strokeWidth={1.5} />
      </div>
      <div>
        <h4 className="font-medium text-foreground text-sm mb-1.5">{title}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {desc}
        </p>
      </div>
    </div>
  )
}
