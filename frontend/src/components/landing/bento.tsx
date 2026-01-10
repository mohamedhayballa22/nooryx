"use client"

import { NooryxFontBold } from "@/app/fonts/typeface"
import { Lock } from "iconoir-react"
import { ScanBarcode } from "lucide-react"

export default function BentoGridSection() {
  // Configuration for the collaboration visual
  const center = { x: 200, y: 140 }
  const avatarRadius = 20
  const centerRadius = 36

  // Data for the 6 surrounding avatars
  const avatars = [
    { id: 1, initials: "JD", x: 50, y: 50 },
    { id: 2, initials: "AS", x: 20, y: 140 },
    { id: 3, initials: "MK", x: 50, y: 230 },
    { id: 4, initials: "TR", x: 350, y: 50 },
    { id: 5, initials: "BL", x: 380, y: 140 },
    { id: 6, initials: "OP", x: 350, y: 230 },
  ]

  // Helper to calculate Bezier path from avatar to center
  const getPath = (start: { id?: number; initials?: string; x: any; y: any }, end: { x: any; y: any }) => {
    const cp1x = start.x + (end.x - start.x) * 0.5
    const cp1y = start.y
    const cp2x = start.x + (end.x - start.x) * 0.5
    const cp2y = end.y
    return `M ${start.x} ${start.y} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${end.x} ${end.y}`
  }

  return (
    <section className="pb-16 sm:pb-24 relative overflow-hidden">
      {/* Custom Animation Styles */}
      <style jsx global>{`
        @keyframes scan-beam {
            0%, 100% { transform: translateY(-100%); opacity: 0; }
            15% { opacity: 1; }
            50% { transform: translateY(100%); opacity: 1; }
            85% { opacity: 1; }
        }

        @keyframes collaborate-beam {
            0% { stroke-dashoffset: 0; opacity: 0; }
            1% { opacity: 1; }
            100% { stroke-dashoffset: -300; opacity: 0; }
        }
        
        @keyframes scroll-vertical {
          0% { transform: translateY(0); }
          100% { transform: translateY(-50%); }
        }
        
        /* Desktop: Only animate on hover */
        @media (min-width: 768px) {
          .group:hover .animate-scan-beam {
              animation: scan-beam 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }

          .group:hover .animate-collab-beam {
              stroke-dasharray: 40 400; 
              animation: collaborate-beam 1.8s linear infinite;
          }
          
          .group:hover .animate-scroll-mobile {
              animation: scroll-vertical 15s linear infinite;
          }
        }
        
        /* Mobile: Always animate */
        @media (max-width: 767px) {
          .animate-scan-beam {
              animation: scan-beam 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
          }

          .animate-collab-beam {
              stroke-dasharray: 40 400; 
              animation: collaborate-beam 1.8s linear infinite;
          }
          
          .animate-scroll-mobile {
              animation: scroll-vertical 15s linear infinite;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl px-6">
        {/* Header Content */}
        <div className="flex flex-col items-center text-center gap-6 mb-12 sm:mb-16 max-w-3xl mx-auto">
          <h2 className={`${NooryxFontBold.className} text-3xl sm:text-4xl md:text-5xl text-pretty leading-[1.1]`}>
            Enterprise Features, <br className="hidden sm:block" />
            <span className="text-foreground/65">none of the enterprise complexity.</span>
          </h2>
        </div>

        {/* Bento Grid */}
        <div className="relative w-full max-w-6xl mx-auto">
          {/* Background Glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-blue-500/5 via-transparent to-purple-500/5 blur-3xl -z-10 rounded-full opacity-60" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
            {/* Card 1 - Top Left - Built-in reservations */}
            <div className="relative rounded-xl border border-border bg-background p-6 h-full min-h-[280px] flex flex-col group hover:border-border/80 transition-colors">
                <div className="flex-1 flex items-center justify-center mb-4">
                    <div className="relative w-44 h-40 flex items-center">
                    <div className="relative w-full h-32">
                        {/* Layer 4 - Back */}
                        <div className="absolute top-0 left-0 w-full h-20 rounded-lg bg-gradient-to-br from-muted/30 to-muted/20 border border-border/40 transform translate-y-0 translate-x-0"></div>
                        {/* Layer 3 */}
                        <div className="absolute top-0 left-0 w-full h-20 rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 transform translate-y-3 translate-x-1.5 transition-all duration-500 ease-in-out group-hover:translate-y-[18px] group-hover:translate-x-[9px]"></div>
                        {/* Layer 2 */}
                        <div className="absolute top-0 left-0 w-full h-20 rounded-lg bg-gradient-to-br from-muted/70 to-muted/50 border border-border/60 transform translate-y-6 translate-x-3 transition-all duration-500 ease-in-out group-hover:translate-y-[36px] group-hover:translate-x-[18px]"></div>
                        {/* Layer 1 - Front */}
                        <div className="absolute top-0 left-0 w-full h-20 rounded-lg bg-gradient-to-br from-muted to-muted/70 border border-border transform translate-y-9 translate-x-[18px] transition-all duration-500 ease-in-out group-hover:translate-y-[54px] group-hover:translate-x-[27px] shadow-sm">
                        <div className="absolute bottom-2 right-2 w-6 h-6 rounded bg-background/80 border border-border/40 flex items-center justify-center">
                            <Lock className="w-3 h-3 text-foreground/80" strokeWidth={1.5} />
                        </div>
                        </div>
                    </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">Built-in reservations</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                    Orders are hard-reserved instantly, making overselling physically impossible.
                    </p>
                </div>
            </div>

            {/* Card 2 - Top Center - LIVE COLLABORATION */}
            <div className="relative rounded-xl border border-border bg-background p-6 h-full min-h-[280px] flex flex-col group hover:border-border/80 transition-colors">
              {/* Visual Container - Now matches other cards with flex-1 and mb-4 */}
              <div className="flex-1 flex items-center justify-center mb-4">
                <div className="relative w-full h-full max-h-[180px]">
                  <svg
                    viewBox="0 0 400 280"
                    className="w-full h-full absolute inset-0 pointer-events-none"
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* 1. Background Concentric Rings */}
                    {[60, 90, 120].map((r, i) => (
                      <circle
                        key={`ring-${i}`}
                        cx={center.x}
                        cy={center.y}
                        r={r}
                        fill="none"
                        stroke="currentColor"
                        className="text-border/40"
                        strokeWidth="1"
                      />
                    ))}

                    {/* 2. Connection Lines (Base Layer) */}
                    {avatars.map((avatar) => (
                      <path
                        key={`path-base-${avatar.id}`}
                        d={getPath(avatar, center)}
                        fill="none"
                        stroke="currentColor"
                        className="text-border"
                        strokeWidth="1.5"
                      />
                    ))}

                    {/* 3. Animated Beams */}
                    {avatars.map((avatar) => (
                      <g key={`beam-group-${avatar.id}`}>
                        <defs>
                          <linearGradient id={`beam-gradient-${avatar.id}`} gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2" />
                            <stop offset="50%" stopColor="currentColor" stopOpacity="1" />
                            <stop offset="100%" stopColor="currentColor" stopOpacity="0.2" />
                          </linearGradient>
                        </defs>
                        <path
                          d={getPath(avatar, center)}
                          fill="none"
                          stroke={`url(#beam-gradient-${avatar.id})`}
                          className="text-primary animate-collab-beam md:opacity-0 md:group-hover:opacity-100"
                          strokeWidth="3"
                          strokeLinecap="round"
                        />
                      </g>
                    ))}

                    {/* 4. Avatar Nodes */}
                    {avatars.map((avatar) => (
                      <g key={`node-${avatar.id}`}>
                        {/* Avatar Circle */}
                        <circle
                          cx={avatar.x}
                          cy={avatar.y}
                          r={avatarRadius}
                          className="fill-background stroke-border"
                          strokeWidth="1.5"
                        />
                        {/* Initials */}
                        <text
                          x={avatar.x}
                          y={avatar.y}
                          dy="0.35em"
                          textAnchor="middle"
                          className="fill-foreground text-[10px] font-medium"
                          style={{ fontFamily: "var(--font-sans)" }}
                        >
                          {avatar.initials}
                        </text>
                      </g>
                    ))}

                    {/* 5. Center Hub (App Logo) */}
                    <g>
                      {/* Hub Circle - Matches card outline/bg */}
                      <circle
                        cx={center.x}
                        cy={center.y}
                        r={centerRadius}
                        className="fill-background stroke-border"
                        strokeWidth="1"
                      />

                      {/* Logo Image */}
                      <foreignObject x={center.x - 16} y={center.y - 16} width="32" height="32">
                        <div className="w-full h-full flex items-center justify-center">
                          <img src="/nooryx-logo.svg" alt="App Logo" className="w-8 h-8 dark:invert" />
                        </div>
                      </foreignObject>
                    </g>
                  </svg>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-foreground">Live collaboration</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Your team can work side by side on inventory, with no delays or confusion.
                </p>
              </div>
            </div>

            {/* Card 3 - Top Right - Hardware Scanner Visual */}
            <div className="relative rounded-xl border border-border bg-background p-6 h-full min-h-[280px] flex flex-col group hover:border-border/80 transition-colors">
              <div className="flex-1 flex items-center justify-center mb-4">
                {/* Visual Scanner Animation */}
                <div className="relative w-48 h-32">
                  {/* The Background Card */}
                  <div className="absolute inset-0 bg-muted/20 border border-border rounded-xl flex items-center justify-center overflow-hidden z-10">
                    {/* Faint static barcode */}
                    <ScanBarcode className="w-16 h-16 text-muted-foreground/20" strokeWidth={1.5} />

                    {/* The Scan Beam Animation */}
                    <div className="absolute inset-0 animate-scan-beam bg-gradient-to-b from-transparent via-primary/10 to-transparent w-full md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute inset-x-0 h-[1px] bg-primary/40 shadow-[0_0_10px_rgba(0,0,0,0.1)] animate-scan-beam md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300" />
                  </div>

                  {/* Pulsing Ring (The "Listening" state) */}
                  <div className="absolute -inset-3 border border-primary/20 rounded-2xl animate-pulse md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute -inset-1 border border-primary/10 rounded-[14px] md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-500" />
                </div>
              </div>

              <div className="space-y-2 relative z-20">
                <h3 className="text-xl font-semibold text-foreground">Scan it. Handle it.</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Works with scanners and cameras to bring the right item up instantly.
                </p>
              </div>
            </div>

            {/* Card 4 - Bottom Left */}
            <div className="relative rounded-xl border border-border bg-background p-6 h-full min-h-[280px] flex flex-col group hover:border-border/80 transition-colors">
                <div className="flex-1 flex items-center justify-center mb-4">
                    <div className="relative w-52 h-36">
                        {/* Map viewport with fading edges */}
                        <div className="absolute inset-0 rounded-lg overflow-hidden">
                        {/* Grid background */}
                        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 208 144">
                            {/* Horizontal grid lines */}
                            <line x1="0" y1="24" x2="208" y2="24" stroke="currentColor" className="text-border/50" strokeWidth="1" />
                            <line x1="0" y1="48" x2="208" y2="48" stroke="currentColor" className="text-border/50" strokeWidth="1" />
                            <line x1="0" y1="72" x2="208" y2="72" stroke="currentColor" className="text-border/50" strokeWidth="1" />
                            <line x1="0" y1="96" x2="208" y2="96" stroke="currentColor" className="text-border/50" strokeWidth="1" />
                            <line x1="0" y1="120" x2="208" y2="120" stroke="currentColor" className="text-border/50" strokeWidth="1" />
                            
                            {/* Vertical grid lines */}
                            <line x1="35" y1="0" x2="35" y2="144" stroke="currentColor" className="text-border/50" strokeWidth="1" />
                            <line x1="70" y1="0" x2="70" y2="144" stroke="currentColor" className="text-border/50" strokeWidth="1" />
                            <line x1="104" y1="0" x2="104" y2="144" stroke="currentColor" className="text-border/50" strokeWidth="1" />
                            <line x1="140" y1="0" x2="140" y2="144" stroke="currentColor" className="text-border/50" strokeWidth="1" />
                            <line x1="174" y1="0" x2="174" y2="144" stroke="currentColor" className="text-border/50" strokeWidth="1" />
                        </svg>
                        
                        {/* Gradient fade mask on all four sides - More subtle */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute inset-0 bg-gradient-to-r from-background via-transparent via-20% to-transparent to-80%" />
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent from-80% via-transparent via-20% to-background" />
                            <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent via-20% to-transparent to-80%" />
                            <div className="absolute inset-0 bg-gradient-to-b from-transparent from-80% via-transparent via-20% to-background" />
                        </div>
                        </div>

                        {/* Pin A: top-left → bottom-right */}
                        <div className="absolute left-[35px] top-[50px] group-hover:left-[180px] group-hover:top-[120px] transition-all duration-500 ease-out -translate-x-1/2 -translate-y-full">
                        <svg width="18" height="24" viewBox="0 0 20 26">
                            <path
                            d="M10 0C4.5 0 0 4.5 0 10c0 7 10 16 10 16s10-9 10-16c0-5.5-4.5-10-10-10z"
                            className="fill-muted-foreground/50"
                            />
                            <circle cx="10" cy="10" r="3.5" className="fill-background/80" />
                        </svg>
                        </div>

                        {/* Pin B: center-left → top-left */}
                        <div className="absolute left-[85px] top-[105px] group-hover:left-[35px] group-hover:top-[50px] transition-all duration-500 ease-out delay-75 -translate-x-1/2 -translate-y-full">
                        <svg width="18" height="24" viewBox="0 0 20 26">
                            <path
                            d="M10 0C4.5 0 0 4.5 0 10c0 7 10 16 10 16s10-9 10-16c0-5.5-4.5-10-10-10z"
                            className="fill-muted-foreground/50"
                            />
                            <circle cx="10" cy="10" r="3.5" className="fill-background/80" />
                        </svg>
                        </div>

                        {/* Pin C: center-right → center-left */}
                        <div className="absolute left-[140px] top-[60px] group-hover:left-[85px] group-hover:top-[105px] transition-all duration-500 ease-out delay-100 -translate-x-1/2 -translate-y-full">
                        <svg width="18" height="24" viewBox="0 0 20 26">
                            <path
                            d="M10 0C4.5 0 0 4.5 0 10c0 7 10 16 10 16s10-9 10-16c0-5.5-4.5-10-10-10z"
                            className="fill-muted-foreground/50"
                            />
                            <circle cx="10" cy="10" r="3.5" className="fill-background/80" />
                        </svg>
                        </div>

                        {/* Pin D: bottom-right → center-right */}
                        <div className="absolute left-[180px] top-[120px] group-hover:left-[140px] group-hover:top-[60px] transition-all duration-500 ease-out delay-150 -translate-x-1/2 -translate-y-full">
                        <svg width="18" height="24" viewBox="0 0 20 26">
                            <path
                            d="M10 0C4.5 0 0 4.5 0 10c0 7 10 16 10 16s10-9 10-16c0-5.5-4.5-10-10-10z"
                            className="fill-muted-foreground/50"
                            />
                            <circle cx="10" cy="10" r="3.5" className="fill-background/80" />
                        </svg>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">Multiple locations, one view</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                    Track stock across all your locations.
                    </p>
                </div>
            </div>

            {/* Card 5 - Bottom right - Table View */}
            <div className="relative rounded-xl border border-border bg-background p-6 h-full min-h-[280px] flex flex-col md:col-span-2 group hover:border-border/80 transition-colors overflow-hidden">
              <div className="flex-1 flex items-center justify-center mb-4">
                <div className="relative w-full max-w-3xl h-40 overflow-hidden rounded-lg select-none">
                  {/* Gradient overlays for fade effect on all four sides */}
                  <div className="absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
                  <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
                  <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
                  <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
                  
                  {/* Scrolling table container */}
                  <div className="absolute inset-0 animate-scroll-mobile">
                    <div className="w-full">
                      {/* Duplicate the rows twice for seamless loop */}
                      {[...Array(2)].map((_, setIndex) => (
                        <div key={setIndex}>
                          {/* Table Header (only show once) */}
                          {setIndex === 0 && (
                            <div className="grid grid-cols-[140px_180px_120px_80px_130px] gap-4 px-4 py-2 bg-muted/50 border-b border-border/50">
                              <span className="text-xs font-medium text-muted-foreground">SKU Code</span>
                              <span className="text-xs font-medium text-muted-foreground">SKU Name</span>
                              <span className="text-xs font-medium text-muted-foreground">Location</span>
                              <span className="text-xs font-medium text-muted-foreground text-right">Available</span>
                              <span className="text-xs font-medium text-muted-foreground">Status</span>
                            </div>
                          )}
                          
                          {/* Table Rows */}
                          {[
                            { sku: "BLT-AL-M10-10", name: "Hex Bolt M10x10 AL", loc: "Main Warehouse", qty: "145", status: "In Stock" },
                            { sku: "BLT-AL-M10-20", name: "Hex Bolt M10x20 AL", loc: "Main Warehouse", qty: "23", status: "Low Stock" },
                            { sku: "LIN-STL-M6-40", name: "Linear Bearing M6x40 STL", loc: "Main Warehouse", qty: "0", status: "Out of Stock" },
                            { sku: "VLT-STL-M8-40", name: "V-Belt M8x40 STL", loc: "Main Warehouse", qty: "8", status: "Low Stock" },
                            { sku: "VLT-STL-M10-40", name: "V-Belt M10x40 STL", loc: "Main Warehouse", qty: "34", status: "In Stock" },
                            { sku: "BLT-SS-M12-20", name: "Hex Bolt M12x20 SS", loc: "Main Warehouse", qty: "89", status: "In Stock" },
                            { sku: "BLT-AL-M12-20", name: "Hex Bolt M12x20 AL", loc: "Main Warehouse", qty: "12", status: "Low Stock" },
                            { sku: "BLT-SS-M10-30", name: "Hex Bolt M10x30 SS", loc: "Main Warehouse", qty: "67", status: "In Stock" },
                          ].map((row, idx) => (
                            <div 
                              key={`${setIndex}-${idx}`}
                              className="grid grid-cols-[140px_180px_120px_80px_130px] gap-4 px-4 py-2.5 border-b border-border/30"
                            >
                              <span className="text-xs font-mono text-foreground/90">{row.sku}</span>
                              <span className="text-xs text-foreground/80 truncate">{row.name}</span>
                              <span className="text-xs text-muted-foreground">{row.loc}</span>
                              <span className="text-xs text-foreground/90 text-right">{row.qty}</span>
                              <span 
                                className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap w-fit ${
                                  row.status === 'In Stock' 
                                    ? 'bg-green-500/10 text-green-600 dark:text-green-400' 
                                    : row.status === 'Low Stock'
                                    ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                }`}
                              >
                                {row.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-semibold text-foreground">Everything at a glance</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Search, filter, and sort your inventory in a familiar table view that stays fast.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
