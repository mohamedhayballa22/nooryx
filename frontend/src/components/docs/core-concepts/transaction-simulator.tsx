'use client';

import { useState } from 'react';
import { ArrowRight, Truck, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BoxIso } from 'iconoir-react';

type State = {
  onHand: number;
  reserved: number;
  available: number;
};

type Change = {
  onHand?: '+' | '-';
  reserved?: '+' | '-';
  available?: '+' | '-';
};

function MetricBox({ 
  label, 
  value, 
  change,
  isResult = false 
}: { 
  label: string;
  value: number;
  change?: '+' | '-';
  isResult?: boolean;
}) {
  const darkBgClass = isResult ? 'dark:bg-[var(--bg-color)]/80' : 'dark:bg-[var(--bg-color)]';

  return (
    <div 
      className={`
        relative flex flex-col items-center justify-center px-6 py-4 rounded-md
        border transition-all duration-300 w-full max-w-[160px] md:w-auto
        ${isResult 
          ? 'border-neutral-300 dark:border-neutral-700 bg-neutral-100 ' + darkBgClass
          : 'border-neutral-200 dark:border-neutral-800 bg-neutral-50 ' + darkBgClass
        }
        ${change ? 'scale-105' : ''}
      `}
    >
      <span className={`
        text-[10px] uppercase tracking-wider font-medium mb-1.5
        ${isResult 
          ? 'text-neutral-600 dark:text-neutral-400' 
          : 'text-neutral-500 dark:text-neutral-500'
        }
      `}>
        {label}
      </span>
      <div className="relative">
        <span className={`
          text-2xl font-mono font-semibold tabular-nums
          text-neutral-900 dark:text-neutral-100
        `}>
          {value}
        </span>
        
        {change && (
          <span 
            className={`
              absolute -left-5 top-1/2 text-lg font-semibold
              ${change === '+' 
                ? 'text-emerald-600 dark:text-emerald-400' 
                : 'text-red-600 dark:text-red-400'
              }
            `}
            style={{
              transform: 'translateY(-50%) scale(0.8)',
              animation: 'fadeInOut 600ms ease-in-out',
              animationFillMode: 'forwards'
            }}
          >
            {change}
            <style jsx>{`
              @keyframes fadeInOut {
                0% { opacity: 0; transform: translateY(-50%) scale(0.8); }
                50% { opacity: 1; transform: translateY(-50%) scale(1); }
                100% { opacity: 0; transform: translateY(-50%) scale(0.8); }
              }
            `}</style>
          </span>
        )}
      </div>
    </div>
  );
}

export function TransactionSimulator() {
  const [state, setState] = useState<State>({ onHand: 100, reserved: 20, available: 80 });
  const [changes, setChanges] = useState<Change>({});

  const handleAction = (type: 'receive' | 'reserve' | 'ship') => {
    setState(prev => {
      const newChanges: Change = {};
      
      switch (type) {
        case 'receive':
          newChanges.onHand = '+';
          newChanges.available = '+';
          setChanges(newChanges);
          setTimeout(() => setChanges({}), 600);
          return { ...prev, onHand: prev.onHand + 10, available: prev.available + 10 };
        
        case 'reserve':
          if (prev.available < 5) return prev;
          newChanges.reserved = '+';
          newChanges.available = '-';
          setChanges(newChanges);
          setTimeout(() => setChanges({}), 600);
          return { ...prev, reserved: prev.reserved + 5, available: prev.available - 5 };
        
        case 'ship':
          if (prev.reserved < 5) return prev;
          newChanges.onHand = '-';
          newChanges.reserved = '-';
          setChanges(newChanges);
          setTimeout(() => setChanges({}), 600);
          return { ...prev, onHand: prev.onHand - 5, reserved: prev.reserved - 5 };
      }
    });
  };

  return (
    <div className="my-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[var(--bg-color)] overflow-hidden">
      
      {/* Controls */}
      <div className="p-4 md:p-6 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center justify-center md:justify-start gap-2">
        <Button onClick={() => handleAction('receive')} variant="outline" className="flex-1 md:flex-none">
          <BoxIso width={16} height={16} />
          <span className="ml-2">Receive +10</span>
        </Button>
        <Button onClick={() => handleAction('reserve')} variant="outline" className="flex-1 md:flex-none">
          <Lock size={14} />
          <span className="ml-2">Reserve +5</span>
        </Button>
        <Button onClick={() => handleAction('ship')} variant="outline" className="flex-1 md:flex-none">
          <Truck size={14} />
          <span className="ml-2">Ship −5</span>
        </Button>
      </div>

      {/* Equation Visualization */}
      <div className="p-6 md:p-10">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-6">
          
          {/* On Hand */}
          <MetricBox 
            label="On Hand" 
            value={state.onHand} 
            change={changes.onHand}
          />
          
          {/* Minus Operator */}
          <div className="flex items-center justify-center w-6 h-6 md:w-8 md:h-8 text-neutral-400 dark:text-neutral-600">
            <span className="text-xl font-light">−</span>
          </div>

          {/* Reserved */}
          <MetricBox 
            label="Reserved" 
            value={state.reserved} 
            change={changes.reserved}
          />

          {/* Equals Arrow - Rotates 90deg on mobile */}
          <div className="flex items-center justify-center w-6 h-6 md:w-8 md:h-8 text-neutral-400 dark:text-neutral-600 transform rotate-90 md:rotate-0">
            <ArrowRight size={18} strokeWidth={1.5} />
          </div>

          {/* Available (Result) */}
          <MetricBox 
            label="Available" 
            value={state.available} 
            change={changes.available}
            isResult
          />
        </div>
      </div>

      <div className="px-6 py-3 bg-neutral-50 dark:bg-[var(--bg-color)]/50 border-t border-neutral-200 dark:border-neutral-800">
        <p className="text-[11px] md:text-xs text-center text-neutral-500 dark:text-neutral-500">
          Interact with the buttons above to see how transactions update inventory state
        </p>
      </div>
    </div>
  );
}
