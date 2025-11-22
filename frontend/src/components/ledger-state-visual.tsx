'use client';

import { useState } from 'react';

export default function LedgerStateVisual() {
  const [step, setStep] = useState(0);

  const entries = [
    { type: 'in', qty: 50, label: 'Received' },
    { type: 'out', qty: 12, label: 'Shipped' },
    { type: 'in', qty: 25, label: 'Received' },
    { type: 'out', qty: 8, label: 'Shipped' },
  ];

  const visible = entries.slice(0, step + 1);
  const state = visible.reduce((s, e) => s + (e.type === 'in' ? e.qty : -e.qty), 0);

  return (
    <div className="my-8 select-none w-full max-w-full">
      {/* Main visual */}
      <div className="flex flex-col md:flex-row items-stretch gap-6 w-full">
        {/* Ledger side */}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
            Ledger
          </div>
          <div className="space-y-2">
            {entries.map((e, i) => {
              const active = i <= step;
              return (
                <div
                  key={i}
                  onClick={() => setStep(i)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-300 ${
                    active
                      ? 'bg-neutral-100 dark:bg-neutral-800/60'
                      : 'opacity-30 hover:opacity-50'
                  }`}
                >
                  <span
                    className={`text-sm font-mono font-medium ${
                      e.type === 'in'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-500 dark:text-red-400'
                    }`}
                  >
                    {e.type === 'in' ? '+' : '−'}
                    {e.qty}
                  </span>
                  <span className="text-sm text-neutral-600 dark:text-neutral-300">
                    {e.label}
                  </span>
                  {i === step && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Arrow */}
        <div className="hidden md:flex items-center text-neutral-300 dark:text-neutral-600">
          <svg
            width="24"
            height="24"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </div>

        {/* State side */}
        <div className="w-full md:w-28 flex flex-col items-center justify-center">
          <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">
            State
          </div>
          <div className="w-32 md:w-full aspect-square rounded-xl bg-neutral-100 dark:bg-neutral-800/60 flex flex-col items-center justify-center mx-auto">
            <div className="text-3xl font-light text-neutral-900 dark:text-neutral-100 transition-all duration-300">
              {state}
            </div>
            <div className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-1">
              on hand
            </div>
          </div>
        </div>
      </div>

      {/* Scrubber */}
      <div className="mt-5 flex items-center gap-3 w-full">
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Past</span>
        <div className="flex-1 flex gap-1">
          {entries.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`flex-1 h-1 rounded-full transition-all duration-200 ${
                i <= step
                  ? 'bg-blue-500'
                  : 'bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600'
              }`}
            />
          ))}
        </div>
        <span className="text-[10px] text-neutral-400 dark:text-neutral-500">Now</span>
      </div>

      {/* Caption */}
      <p className="mt-4 text-xs text-neutral-500 dark:text-neutral-400 text-center">
        Click entries or scrub the timeline to see how state is derived.
      </p>
    </div>
  );
}
