'use client';

import { BoxIso } from 'iconoir-react';
import React from 'react';

export function BarcodeIllustration() {
  return (
    <div className="not-prose my-12 w-full">
      <div className="relative rounded-xl border border-neutral-200 bg-background p-8 dark:border-neutral-800">
        
        <div className="relative mx-auto max-w-3xl z-10">
          
          <div className="grid grid-cols-[220px_1fr_220px] h-[300px] items-center">
            
            {/* Left Column */}
            <div className="grid grid-rows-3 h-full w-full relative z-10">
              <div className="flex items-center">
                <BarcodeCard type="UPC-A" value="012345678905" icon={<BarcodeIcon />} />
              </div>
              <div className="flex items-center">
                <BarcodeCard type="EAN-13" value="5901234123457" icon={<BarcodeIcon />} />
              </div>
              <div className="flex items-center">
                <BarcodeCard type="Internal QR" value="QR-INT-001" icon={<QRIcon />} />
              </div>
            </div>

            {/* Center Lines */}
            <div className="relative h-full w-full -mx-4 z-0">
              <svg
                className="absolute inset-0 h-full text-neutral-300 dark:text-neutral-800"
                style={{ width: 'calc(100% + 1.5rem)' }}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                preserveAspectRatio="none"
                viewBox="0 0 100 100"
              >
                <path d="M 0 16.66 C 50 16.66, 60 50, 100 50" vectorEffect="non-scaling-stroke" />
                <path d="M 0 50 L 100 50" vectorEffect="non-scaling-stroke" />
                <path d="M 0 83.33 C 50 83.33, 60 50, 100 50" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>

            {/* Right Column */}
            <div className="relative z-10 flex items-center justify-center h-full">
              <div className="w-full group relative flex flex-col items-start gap-4 rounded-xl border border-neutral-200 bg-background p-5 shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700">
                
                {/* Connector Dot */}
                <div className="absolute top-1/2 -left-1.5 h-2.5 w-2.5 -translate-y-1/2 rounded-full border border-neutral-200 bg-background dark:border-neutral-800" />

                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                  <BoxIso />
                </div>
                
                <div className="space-y-0.5">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                    Resolves To
                  </div>
                  <div className="font-mono text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    TSHIRT-CREW-BLK
                  </div>
                </div>
                
                <div className="w-full border-t border-dashed border-neutral-200 pt-3 dark:border-neutral-800">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-500 font-medium">Available</span>
                    <span className="font-mono font-medium text-neutral-900 dark:text-neutral-200">291</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
      
      <p className="mt-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
        Multiple barcodes mapping to a single SKU.
      </p>
    </div>
  );
}

function BarcodeCard({ type, value, icon }: { type: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="w-full group relative flex items-center gap-3 rounded-lg border border-neutral-200 bg-background px-3 py-3 shadow-sm transition-all hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700">
      
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-neutral-50 text-neutral-400 border border-neutral-100 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-500">
        {icon}
      </div>

      <div className="min-w-0 flex flex-col">
        <div className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider leading-none mb-1 dark:text-neutral-500">
          {type}
        </div>
        <div className="truncate font-mono text-sm font-medium text-neutral-900 dark:text-neutral-200 leading-none">
          {value}
        </div>
      </div>

      {/* Right-side Connector Dot */}
      <div className="absolute top-1/2 -right-1.5 h-2 w-2 -translate-y-1/2 rounded-full border border-neutral-200 bg-background dark:border-neutral-800" />
    </div>
  );
}

// Icons
const BarcodeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M10 5V19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M15 5V19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M20 5V19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

const QRIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
    <path d="M3 14h2" />
    <path d="M3 19h2" />
    <path d="M8 14v5" />
  </svg>
);
