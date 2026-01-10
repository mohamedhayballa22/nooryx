"use client"

import { NooryxFontBold } from "@/app/fonts/typeface"
import { 
  AreaSearch, 
  DataTransferBoth,
  StatsReport,
} from "iconoir-react"
import { ChevronDown } from "lucide-react"

export default function AnalyticsSection() {
  return (
    <section className="py-24 relative bg-background">
      <div className="mx-auto max-w-7xl px-6">
        
        {/* Section Header */}
        <div className="flex flex-col items-start gap-6 mb-12 sm:mb-16 max-w-6xl mx-auto">
          <h2 className={`${NooryxFontBold.className} text-3xl sm:text-4xl md:text-5xl text-pretty leading-[1.1]`}>
            From numbers<br className="hidden sm:block" />
            <span className="text-foreground/65">to decisions.</span>
          </h2>
        </div>

        {/* Grid Container */}
        <div className="relative w-full max-w-6xl mx-auto">
            
          {/* Sharp Grid */}
          <div className="bg-border grid grid-cols-1 md:grid-cols-6 lg:grid-cols-12 gap-px w-full border border-border rounded-md overflow-hidden">
            
            {/* --- VISUAL 1: Inventory Trends (The Area Chart) --- */}
            <div className="col-span-1 md:col-span-6 lg:col-span-8 bg-background p-8 min-h-[320px] flex flex-col justify-between group overflow-hidden relative">
              <div className="relative z-10 flex items-start justify-between">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-foreground">Inventory Trend</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">Track stock levels over time to identify patterns and opportunities.</p>
                </div>
                {/* Period selector */}
                <div className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-background hover:bg-muted/50 transition-colors text-xs font-medium cursor-pointer select-none group-hover:text-foreground">
                    <span>Last Month</span>
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
              </div>

              {/* CSS/SVG Chart Visualization */}
              <div className="absolute bottom-0 left-0 right-0 h-[200px] w-full opacity-80">
                <svg className="w-full h-full" viewBox="0 0 100 50" preserveAspectRatio="none">
                    {/* Gradient Definition */}
                    <defs>
                        <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="currentColor" className="text-foreground" stopOpacity="0.1" />
                            <stop offset="100%" stopColor="currentColor" className="text-foreground" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    {/* The Line - More detailed with finer bumps */}
                    <path 
                        d="M0,40 C3,39 5,38 8,42 C11,46 13,44 16,38 C19,32 21,35 24,30 C27,25 29,28 32,24 C35,20 37,22 40,18 C43,14 45,17 48,20 C51,23 53,21 56,17 C59,13 61,15 64,12 C67,9 69,11 72,10 C75,9 77,7 80,8 C83,9 85,6 88,5 C91,4 93,6 96,8 C98,9 99,7 100,5 V50 H0 Z" 
                        fill="url(#chartGradient)" 
                        className="text-foreground"
                    />
                    <path 
                        d="M0,40 C3,39 5,38 8,42 C11,46 13,44 16,38 C19,32 21,35 24,30 C27,25 29,28 32,24 C35,20 37,22 40,18 C43,14 45,17 48,20 C51,23 53,21 56,17 C59,13 61,15 64,12 C67,9 69,11 72,10 C75,9 77,7 80,8 C83,9 85,6 88,5 C91,4 93,6 96,8 C98,9 99,7 100,5" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="0.5"
                        className="text-foreground"
                    />
                </svg>
              </div>

              {/* Hover Overlay Tooltip Mock */}
              <div className="absolute top-1/2 left-2/3 -translate-x-1/2 -translate-y-1/2 bg-background border border-border px-3 py-2 rounded shadow-xl hidden group-hover:block transition-all z-20">
                <div className="text-xs text-muted-foreground mb-1">October 24, 2024</div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-medium">On Hand</span>
                    <span className="font-mono text-sm font-bold">2,420</span>
                </div>
              </div>
            </div>

            {/* --- VISUAL 2: Top Fast Movers --- */}
            <div className="order-3 md:order-none col-span-1 md:col-span-6 lg:col-span-4 bg-background p-6 lg:p-8 flex flex-col group">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-foreground">Top Fast Movers</h3>
                    {/* Period selector - hidden on mobile */}
                    <div className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-background hover:bg-muted/50 transition-colors text-xs font-medium cursor-pointer select-none">
                        <span>Last Month</span>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                </div>

                <div className="space-y-4 flex-1">
                    {/* Row 1 */}
                    <MoverRow 
                        rank={1}
                        code="BLT-SS-M10" 
                        name="Hex Bolt M10×20 SS" 
                        value={95} 
                        total={100}
                    />
                    {/* Row 2 */}
                    <MoverRow 
                        rank={2}
                        code="LIN-STL-M10" 
                        name="Linear Bearing M10" 
                        value={82} 
                        total={100}
                    />
                     {/* Row 3 */}
                     <MoverRow 
                        rank={3}
                        code="BLT-AL-M12" 
                        name="Hex Bolt M12×40 AL" 
                        value={49} 
                        total={100}
                    />
                </div>
            </div>

            {/* --- MIDDLE: Context Text --- */}
            <div className="order-2 md:order-none col-span-1 md:col-span-6 lg:col-span-8 bg-background p-8 flex flex-col justify-center">
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Clear signals, right where you work.
              </h3>
              <p className="text-muted-foreground leading-relaxed text-lg max-w-2xl">
                Identify dead stock before it costs you storage fees, spot demand spikes before you stock out, and understand product velocity at a glance.
                Built into your workflow, not buried in reports.
              </p>
            </div>

             {/* --- MIDDLE RIGHT: Inactive Stock --- */}
             <div className="order-4 md:order-none col-span-1 md:col-span-6 lg:col-span-4 bg-background p-6 lg:p-8 flex flex-col group">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-semibold text-foreground">Inactive Stock</h3>
                    {/* Period selector - hidden on mobile */}
                    <div className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-background hover:bg-muted/50 transition-colors text-xs font-medium cursor-pointer select-none">
                        <span>Inactive 30+ days</span>
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                </div>

                <div className="space-y-4 flex-1">
                    {/* Row 1 */}
                    <MoverRow 
                        rank={1}
                        code="WDG-PLY-L8" 
                        name="Plywood Wedge L8" 
                        value={12} 
                        total={20}
                    />
                    {/* Row 2 */}
                    <MoverRow 
                        rank={2}
                        code="SPR-CMP-M6" 
                        name="Compression Spring M6" 
                        value={8} 
                        total={20}
                    />
                </div>
            </div>

            {/* --- BOTTOM ROW: Features --- */}
            
            <FeatureCard 
                icon={StatsReport}
                title="Historical Snapshots"
                desc="Audit historical inventory from global views down to individual SKUs and locations."
            />
            
            <FeatureCard 
                icon={AreaSearch}
                title="Stockout Prediction"
                desc="Velocity-based forecasting highlights items that need reordering before you hit zero."
            />

            <FeatureCard 
                icon={DataTransferBoth}
                title="Granular Export"
                desc="Pull raw data for any metric. Compatible with Excel, CSV, and downstream BI tools."
            />

          </div>
        </div>
      </div>
    </section>
  )
}

function FeatureCard({ icon: Icon, title, desc }: { icon: any, title: string, desc: string }) {
  return (
    <div className="order-5 md:order-none col-span-1 md:col-span-2 lg:col-span-4 bg-background p-8 flex flex-col gap-4 border-t border-border lg:border-t-0">
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

function MoverRow({ rank, code, name, value, total }: { rank: number, code: string, name: string, value: number, total: number }) {
    return (
        <div className="group/row flex items-start sm:items-center gap-3 px-3 py-3 rounded-lg border border-muted/20 bg-muted/5 hover:bg-muted/15 hover:border-muted/40 transition-all">
            {/* Rank Badge */}
            <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{rank}</span>
            </div>

            {/* Product Info */}
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <p className="font-medium text-foreground truncate text-sm">
                    {code}
                </p>
                <p className="text-xs text-muted-foreground truncate leading-tight">
                    {name}
                </p>
            </div>

            {/* Progress Bar and Value */}
            <div className="flex-shrink-0 flex flex-col items-end gap-1.5 sm:flex-row sm:items-center sm:gap-3">
                {/* Progress Bar */}
                <div className="w-14 sm:w-16">
                    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                        <div 
                            className="h-full bg-foreground/80 group-hover/row:bg-foreground transition-all duration-300" 
                            style={{ width: `${(value / total) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Available Count */}
                <div className="text-right min-w-[45px]">
                    <p className="text-base font-bold tabular-nums leading-none">
                        {value}
                    </p>
                    <p className="text-[10px] uppercase text-muted-foreground">
                        Available
                    </p>
                </div>
            </div>
        </div>
    )
}
