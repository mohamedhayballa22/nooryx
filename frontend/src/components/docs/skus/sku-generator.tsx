'use client';

import React, { useState } from 'react';

// --- Constants & Types ---

type SkuSegment = {
  id: string;
  label: string;
  value: string;
  desc: string;
};

const CATEGORIES: SkuSegment[] = [
  { id: 'shirt', label: 'T-Shirt', value: 'TSH', desc: 'Product Type' },
  { id: 'shoes', label: 'Shoes', value: 'SHO', desc: 'Product Type' },
  { id: 'hat', label: 'Hat', value: 'HAT', desc: 'Product Type' },
];

const ATTRIBUTES: SkuSegment[] = [
  { id: 'sm', label: 'Small', value: 'SM', desc: 'Size' },
  { id: 'md', label: 'Medium', value: 'MD', desc: 'Size' },
  { id: 'lg', label: 'Large', value: 'LG', desc: 'Size' },
];

const VARIANTS: SkuSegment[] = [
  { id: 'blk', label: 'Black', value: 'BLK', desc: 'Color' },
  { id: 'wht', label: 'White', value: 'WHT', desc: 'Color' },
  { id: 'red', label: 'Red', value: 'RED', desc: 'Color' },
];

export function SkuBuilder() {
  const [cat, setCat] = useState(CATEGORIES[0]);
  const [attr, setAttr] = useState(ATTRIBUTES[0]);
  const [variant, setVariant] = useState(VARIANTS[0]);
  const [customSuffix, setCustomSuffix] = useState('');

  const fullSku = `${cat.value}-${attr.value}-${variant.value}${customSuffix ? `-${customSuffix.toUpperCase()}` : ''}`;

  // Fixed Analysis Logic
  const hasSpaces = customSuffix.includes(' ');
  const hasConfusingChars = /[0O1Il]/.test(customSuffix);
  const hasSpecialChars = /[^a-zA-Z0-9]/.test(customSuffix);
  const isConsistentLength = customSuffix.length === 0 || (customSuffix.length >= 2 && customSuffix.length <= 4);

  return (
    <div className="not-prose my-12 w-full">
      <div className="relative rounded-xl border border-neutral-200 bg-[var(--bg-color)] dark:border-neutral-800 dark:bg-[var(--bg-color-dark)] overflow-hidden">
        
        <div className="relative flex flex-col md:flex-row">
          
          {/* LEFT: Builder Controls */}
          <div className="flex-1 p-8 border-b md:border-b-0 md:border-r border-neutral-200 dark:border-neutral-800">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-6 flex items-center gap-2">
              Build An SKU Code
            </h3>

            <div className="space-y-8">
              <ControlGroup 
                label="1. Product Type" 
                options={CATEGORIES} 
                selected={cat} 
                onChange={setCat} 
              />

              <ControlGroup 
                label="2. Size" 
                options={ATTRIBUTES} 
                selected={attr} 
                onChange={setAttr} 
              />

              <ControlGroup 
                label="3. Color" 
                options={VARIANTS} 
                selected={variant} 
                onChange={setVariant} 
              />

              {/* Step 4: Custom Suffix */}
              <div className="space-y-3">
                <label className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
                  4. Optional ID (Try typing: space, 0, O, 1, I, l)
                </label>
                <input 
                  type="text" 
                  value={customSuffix}
                  onChange={(e) => setCustomSuffix(e.target.value)}
                  placeholder="e.g. A836, Y72"
                  maxLength={6}
                  className={`
                    w-full rounded-lg border bg-[var(--bg-color)] px-3 py-2 text-sm font-mono transition-all 
                    focus:outline-none focus:ring-2 dark:bg-[var(--bg-color-dark)]
                    ${
                      hasConfusingChars || hasSpaces || hasSpecialChars
                        ? 'border-red-300 focus:ring-red-200 dark:border-red-800 dark:focus:ring-red-900' 
                        : !isConsistentLength && customSuffix.length > 0
                          ? 'border-amber-300 focus:ring-amber-200 dark:border-amber-800 dark:focus:ring-amber-900'
                          : 'border-neutral-200 focus:ring-neutral-200 dark:border-neutral-800 dark:focus:ring-neutral-800'
                    }
                  `}
                />
              </div>
            </div>
          </div>

          {/* RIGHT: Live Preview & Audit */}
          <div className="w-full md:w-80 bg-[var(--bg-color)]/50 dark:bg-[var(--bg-color-dark)]/20 p-8 flex flex-col">
            
            {/* The Big SKU Display */}
            <div className="mb-8 p-4 rounded-xl border border-neutral-200 bg-[var(--bg-color)] shadow-sm dark:border-neutral-800 dark:bg-[var(--bg-color-dark)]">
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-widest text-neutral-400 mb-1">SKU Code</div>
                <div className="font-mono text-xl font-bold text-neutral-900 dark:text-white break-all">
                  {fullSku}
                </div>
                <div className="text-[10px] text-neutral-400 mt-2">
                  Example: {cat.label} · {attr.label} · {variant.label}
                </div>
              </div>
            </div>

            {/* Audit */}
            <div className="flex-1 space-y-4">
              <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">
                Quality Checks
              </div>

              <AuditItem 
                pass={!hasSpaces} 
                label="No Spaces" 
                desc={hasSpaces ? "Spaces break systems. Remove them." : "Good! No spaces found."}
              />
              
              <AuditItem 
                pass={!hasConfusingChars} 
                label="Clear Characters" 
                desc={hasConfusingChars ? "Avoid: 0/O, 1/I/l - they look similar." : "All characters are distinct."}
              />

              <AuditItem 
                pass={!hasSpecialChars || customSuffix.length === 0} 
                label="Letters & Numbers Only" 
                desc={hasSpecialChars ? "Remove symbols. Use A-Z and 0-9 only." : "Only valid characters used."}
              />

              <AuditItem 
                pass={true} 
                label="Organized Structure" 
                desc="Goes from general to specific."
              />

              <AuditItem 
                pass={isConsistentLength || customSuffix.length === 0}
                label="Standard Length"
                desc={isConsistentLength || customSuffix.length === 0 ? "Optional ID follows guidelines." : "Keep ID between 2-4 characters."}
                warning={!isConsistentLength && customSuffix.length > 0}
              />

            </div>
          </div>
        </div>
      </div>
      
      <p className="mt-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
        A good SKU code is easy to read, sort, and search in your inventory.
      </p>
    </div>
  );
}

// --- Sub-Components ---

function ControlGroup({ label, options, selected, onChange }: { 
  label: string, 
  options: SkuSegment[], 
  selected: SkuSegment, 
  onChange: (s: SkuSegment) => void 
}) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-neutral-500">
        {label}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const isActive = selected.id === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt)}
              className={`
                relative flex flex-col items-center justify-center p-3 rounded-lg border-1 text-sm transition-all cursor-pointer
                ${
                  isActive 
                    ? 'bg-[var(--bg-color)] border-neutral-900 text-neutral-900 shadow-sm dark:bg-[var(--bg-color-dark)] dark:border-white dark:text-white' 
                    : 'bg-[var(--bg-color)] border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:bg-[var(--bg-color)]/80 dark:bg-[var(--bg-color-dark)] dark:border-neutral-800 dark:text-neutral-400'
                }
              `}
            >
              <span className="font-mono font-semibold text-xs mb-1">{opt.value}</span>
              <span className={`text-[10px] font-medium ${isActive ? 'text-bold-500 dark:text-bold-400' : 'text-neutral-500 dark:text-neutral-400'}`}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AuditItem({ pass, label, desc, warning }: { pass: boolean, label: string, desc: string, warning?: boolean }) {
  return (
    <div className="flex gap-3 items-start">
      <div className={`
        mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border
        ${pass && !warning
          ? 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/30 dark:bg-emerald-900/10 dark:text-emerald-500' 
          : warning 
            ? 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-500'
            : 'border-red-200 bg-red-50 text-red-600 dark:border-red-900/30 dark:bg-red-900/10 dark:text-red-500'
        }
      `}>
        {pass && !warning ? <CheckIcon /> : warning ? <DotIcon /> : <CrossIcon />}
      </div>
      <div>
        <div className={`text-xs font-medium ${pass && !warning ? 'text-neutral-900 dark:text-neutral-200' : warning ? 'text-amber-700 dark:text-amber-500' : 'text-red-700 dark:text-red-500'}`}>
          {label}
        </div>
        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-tight mt-0.5">
          {desc}
        </div>
      </div>
    </div>
  );
}

// --- Icons ---

const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const CrossIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const DotIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <circle cx="12" cy="12" r="6" />
  </svg>
);
