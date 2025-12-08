'use client';

import { BoxIso } from "iconoir-react";

export function MultiLocationVisual() {
  return (
    <div className="not-prose my-12 w-full">
      <div className="relative rounded-xl border border-neutral-200 bg-[var(--bg-color)] p-8 dark:border-neutral-800 dark:bg-[var(--bg-color-dark)]">
        
        <div className="relative mx-auto max-w-2xl z-10">
          
          <div className="flex justify-center relative z-20">
            <div className="group relative flex items-center gap-3 rounded-lg border border-neutral-200 bg-[var(--bg-color)] px-5 py-3 shadow-sm transition-all hover:border-neutral-300 dark:border-neutral-800 dark:bg-[var(--bg-color-dark)] dark:hover:border-neutral-700">
              
              <div className="flex h-8 w-8 items-center justify-center rounded bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                <BoxIso />
              </div>

              <div className="flex flex-col">
                <span className="font-mono text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  TSHIRT-CREW-BLK
                </span>
              </div>

              {/* Connector dot */}
              <div className="absolute -bottom-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-neutral-200 bg-[var(--bg-color)] dark:border-neutral-800 dark:bg-[var(--bg-color-dark)]" />
            </div>
          </div>

          {/* Connection Lines Layer */}
          <div className="relative h-16 w-full -my-1 z-0">
            <svg
              className="absolute inset-0 h-full w-full text-neutral-300 dark:text-neutral-800"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              preserveAspectRatio="none"
              viewBox="0 0 100 100"
            >
              <path d="M 50 0 C 50 50, 15 50, 15 100" vectorEffect="non-scaling-stroke" />
              <path d="M 50 0 L 50 100" vectorEffect="non-scaling-stroke" />
              <path d="M 50 0 C 50 50, 85 50, 85 100" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>

          {/* Bottom Nodes */}
          <div className="grid grid-cols-3 gap-4 relative z-10">
            <LocationNode name="San Francisco" count={142} />
            <LocationNode name="London" count={85} />
            <LocationNode name="Tokyo" count={64} />
          </div>

          {/* Aggregation Summary */}
          <div className="mt-8 flex justify-center">
            <div className="flex items-center gap-3 rounded-full border border-neutral-200 bg-[var(--bg-color)]/80 px-4 py-1.5 text-xs text-neutral-600 backdrop-blur-sm dark:border-neutral-800 dark:bg-[var(--bg-color-dark)]/80 dark:text-neutral-400">
              <span className="font-medium">Total Stock</span>
              <span className="h-3 w-px bg-neutral-300 dark:bg-neutral-700" />
              <span className="font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                291
              </span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

function LocationNode({ name, count }: { name: string; count: number }) {
  return (
    <div className="group relative flex flex-col items-center justify-center rounded-lg border border-neutral-200 bg-[var(--bg-color)] py-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-[var(--bg-color-dark)]">
      
      {/* Connector dot */}
      <div className="absolute -top-1.5 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-neutral-200 bg-[var(--bg-color)] dark:border-neutral-800 dark:bg-[var(--bg-color-dark)]" />
      
      <div className="text-xs font-medium text-neutral-500 mb-1">{name}</div>
      <div className="font-mono text-xl font-semibold tracking-tight text-neutral-900 dark:text-white tabular-nums">
        {count}
      </div>
    </div>
  );
}
