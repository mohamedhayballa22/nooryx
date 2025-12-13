'use client';

import { useState, useEffect, useRef } from 'react';
import { Package, Send, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ValuationMethod = 'FIFO' | 'LIFO' | 'WAC';

type CostLayer = {
  id: number;
  qty: number;
  cost: number;
  timestamp: number;
  highlighted?: 'add' | 'remove';
  removing?: boolean;
};

const MAX_LAYERS = 10;

const getInitialLayers = (method: ValuationMethod): CostLayer[] => {
  return [{ id: 1, qty: 100, cost: 10, timestamp: 1 }];
};

// Helper component for pulsing text colors
function AnimatedMetric({ value, skipAnimation }: { value: number; skipAnimation?: boolean }) {
  const [colorClass, setColorClass] = useState('text-neutral-900 dark:text-neutral-100');
  const prevValue = useRef(value);

  useEffect(() => {
    if (skipAnimation) {
      prevValue.current = value;
      return;
    }

    if (value > prevValue.current) {
      setColorClass('text-emerald-600 dark:text-emerald-500');
    } else if (value < prevValue.current) {
      setColorClass('text-rose-600 dark:text-rose-500');
    }

    const timer = setTimeout(() => {
      setColorClass('text-neutral-900 dark:text-neutral-100');
    }, 600);

    prevValue.current = value;
    return () => clearTimeout(timer);
  }, [value, skipAnimation]);

  return (
    <span className={`text-2xl font-mono font-medium tracking-tight transition-colors duration-500 ${colorClass}`}>
      ${value.toFixed(2)}
    </span>
  );
}

function LayerBar({
  layer,
  index,
  method,
  maxQty
}: {
  layer: CostLayer;
  index: number;
  method: ValuationMethod;
  maxQty: number;
}) {
  const widthPercent = (layer.qty / maxQty) * 100;

  return (
    <div
      className={`
        relative flex items-center gap-3 py-2 group
        ${layer.removing ? 'opacity-0 scale-[0.98]' : 'opacity-100'}
      `}
      style={{
        transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Index/Order ID */}
      {method !== 'WAC' && (
        <div className="w-6 flex justify-center">
          <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-600">
            {method === 'FIFO' ? index + 1 : layer.timestamp}
          </span>
        </div>
      )}

      {/* Visual Bar Area */}
      <div className="flex-1 relative h-8 rounded-md bg-neutral-100 dark:bg-[var(--bg-color)] overflow-hidden">
        {/* The Actual Bar */}
        <div
          className={`
            absolute left-0 top-0 h-full transition-all duration-500 ease-out
            ${layer.highlighted === 'add'
              ? 'bg-emerald-500 dark:bg-emerald-500'
              : layer.highlighted === 'remove'
                ? 'bg-rose-500 dark:bg-rose-500'
                : 'bg-neutral-800 dark:bg-neutral-200'
            }
          `}
          style={{ width: `${widthPercent}%` }}
        />

        {/* Text Content (Overlay) */}
        <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
          <span className={`
            text-xs font-mono font-medium transition-colors duration-300
            ${layer.highlighted
              ? 'text-white'
              : 'text-neutral-100 dark:text-neutral-900 mix-blend-normal'
            }
          `}>
            {layer.qty} units
          </span>
          <span className={`
            text-xs font-mono transition-colors duration-300
            ${layer.highlighted
              ? 'text-white/90'
              : 'text-neutral-400 dark:text-neutral-500'
            }
          `}>
             ${layer.cost.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Total Value Column */}
      <div className="w-20 text-right">
        <span className="text-xs font-mono text-neutral-600 dark:text-neutral-400">
          ${(layer.qty * layer.cost).toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export function ValuationSimulator() {
  const [method, setMethod] = useState<ValuationMethod>('FIFO');
  const [layers, setLayers] = useState<CostLayer[]>(getInitialLayers('FIFO'));
  const [cogs, setCogs] = useState<number>(0);
  const [skipMetricAnimation, setSkipMetricAnimation] = useState(false);

  // Store pre-WAC state for restoration
  const preWACLayers = useRef<CostLayer[]>([]);

  const [qtyToReceive, setQtyToReceive] = useState<number | ''>(50);
  const [costPerUnit, setCostPerUnit] = useState<number | ''>(11);
  const [qtyToShip, setQtyToShip] = useState<number | ''>(10);

  const [nextId, setNextId] = useState(2);
  const [nextTimestamp, setNextTimestamp] = useState(2);
  const [showMaxLayersWarning, setShowMaxLayersWarning] = useState(false);

  const totalUnits = layers.reduce((sum, l) => sum + l.qty, 0);
  const inventoryValue = layers.reduce((sum, l) => sum + l.qty * l.cost, 0);
  const avgCost = totalUnits > 0 ? (inventoryValue / totalUnits).toFixed(2) : '0.00';

  const isReceiveValid = qtyToReceive !== '' && qtyToReceive > 0 && costPerUnit !== '' && costPerUnit > 0;
  const isShipValid = qtyToShip !== '' && qtyToShip > 0 && qtyToShip <= totalUnits;

  const handleReset = () => {
    const newLayers = getInitialLayers(method);
    setLayers(newLayers);
    setCogs(0);
    setNextId(2);
    setNextTimestamp(2);
    preWACLayers.current = [];
    setShowMaxLayersWarning(false);
  };

  const handleMethodChange = (newMethod: ValuationMethod) => {
    const previousMethod = method;
    setMethod(newMethod);

    // Skip animation for method changes
    setSkipMetricAnimation(true);

    // When switching TO WAC from FIFO/LIFO: save current state and squash
    if (newMethod === 'WAC' && previousMethod !== 'WAC') {
      // Save the current detailed layers
      preWACLayers.current = [...layers];

      // Squash into single weighted average layer
      if (layers.length > 0) {
        const totalQty = layers.reduce((sum, l) => sum + l.qty, 0);
        const totalValue = layers.reduce((sum, l) => sum + l.qty * l.cost, 0);
        const newAvgCost = totalQty > 0 ? Math.round((totalValue / totalQty) * 100) / 100 : 0;

        setLayers([{
          id: nextId,
          qty: totalQty,
          cost: newAvgCost,
          timestamp: nextTimestamp,
        }]);
        setNextId(prev => prev + 1);
        setNextTimestamp(prev => prev + 1);
      }
    }

    // When switching FROM WAC to FIFO/LIFO: restore saved state if it exists
    if (previousMethod === 'WAC' && newMethod !== 'WAC') {
      if (preWACLayers.current.length > 0) {
        setLayers([...preWACLayers.current]);
        preWACLayers.current = [];
      }
      // If no saved state, keep current layers as-is (they're already valid)
    }

    // Re-enable animation after a brief delay
    setTimeout(() => {
      setSkipMetricAnimation(false);
    }, 50);

    // FIFO <-> LIFO: no transformation needed, same layers work for both
  };

  const handleReceive = () => {
    if (!isReceiveValid) return;

    setSkipMetricAnimation(false);

    const qty = Number(qtyToReceive);
    const cost = Number(costPerUnit);

    if (method !== 'WAC' && layers.length >= MAX_LAYERS) {
      const lastLayer = layers[layers.length - 1];
      const canMerge = lastLayer && lastLayer.cost === cost;

      if (!canMerge) {
        setShowMaxLayersWarning(true);
        setTimeout(() => setShowMaxLayersWarning(false), 3000);
        return;
      }
    }

    if (method === 'WAC') {
      // WAC: recalculate weighted average
      const allLayers = [...layers, { qty: qty, cost: cost }];
      const totalQty = allLayers.reduce((sum, l) => sum + l.qty, 0);
      const totalValue = allLayers.reduce((sum, l) => sum + (l.qty * l.cost), 0);
      const newAvgCost = Math.round((totalValue / totalQty) * 100) / 100;

      setLayers([{
        id: nextId,
        qty: totalQty,
        cost: newAvgCost,
        timestamp: nextTimestamp,
        highlighted: 'add',
      }]);
      setNextId(prev => prev + 1);
      setNextTimestamp(prev => prev + 1);
    } else {
      // FIFO/LIFO: add layer or merge with last if same cost
      const lastLayer = layers[layers.length - 1];

      if (lastLayer && lastLayer.cost === cost) {
        const updatedLayers = [...layers];
        updatedLayers[updatedLayers.length - 1] = {
          ...lastLayer,
          qty: lastLayer.qty + qty,
          highlighted: 'add'
        };
        setLayers(updatedLayers);
      } else {
        const newLayer: CostLayer = {
          id: nextId,
          qty: qty,
          cost: cost,
          timestamp: nextTimestamp,
          highlighted: 'add',
        };
        setLayers([...layers, newLayer]);
        setNextId(prev => prev + 1);
        setNextTimestamp(prev => prev + 1);
      }
    }

    setTimeout(() => {
      setLayers(prev => prev.map(l => ({ ...l, highlighted: undefined })));
    }, 600);
  };

  const handleShip = () => {
    if (!isShipValid) return;

    setSkipMetricAnimation(false);

    let remaining = Number(qtyToShip);
    let cost = 0;
    const newLayers = [...layers];

    // Clear previous highlights
    newLayers.forEach(l => {
      l.highlighted = undefined;
      l.removing = false;
    });

    if (method === 'FIFO') {
      // Consume from oldest (start of array)
      for (let i = 0; i < newLayers.length && remaining > 0; i++) {
        const consumeQty = Math.min(newLayers[i].qty, remaining);
        cost += consumeQty * newLayers[i].cost;
        newLayers[i].qty -= consumeQty;
        newLayers[i].highlighted = 'remove';
        if (newLayers[i].qty === 0) {
          newLayers[i].removing = true;
        }
        remaining -= consumeQty;
      }
    } else if (method === 'LIFO') {
      // Consume from newest (end of array / highest timestamp)
      for (let i = newLayers.length - 1; i >= 0 && remaining > 0; i--) {
        const consumeQty = Math.min(newLayers[i].qty, remaining);
        cost += consumeQty * newLayers[i].cost;
        newLayers[i].qty -= consumeQty;
        newLayers[i].highlighted = 'remove';
        if (newLayers[i].qty === 0) {
          newLayers[i].removing = true;
        }
        remaining -= consumeQty;
      }
    } else if (method === 'WAC') {
      // WAC: consume proportionally from all layers
      const totalQty = newLayers.reduce((sum, l) => sum + l.qty, 0);
      if (totalQty >= remaining && newLayers.length > 0) {
        const avgCost = newLayers[0].cost; // In WAC all layers have same cost
        cost = remaining * avgCost;

        // Distribute consumption proportionally
        let distributed = 0;
        newLayers.forEach((layer, idx) => {
          const proportion = layer.qty / totalQty;
          let consumeQty = Math.floor(proportion * remaining);

          // Give remainder to last layer to avoid rounding issues
          if (idx === newLayers.length - 1) {
            consumeQty = remaining - distributed;
          }

          layer.qty = Math.max(0, layer.qty - consumeQty);
          layer.highlighted = 'remove';
          if (layer.qty === 0) {
            layer.removing = true;
          }
          distributed += consumeQty;
        });
      }
    }

    setCogs(prev => prev + cost);
    setLayers(newLayers);

    // Clear highlights
    setTimeout(() => {
      setLayers(prev => prev.map(l => ({ ...l, highlighted: undefined })));
    }, 600);

    // Remove empty layers
    setTimeout(() => {
      setLayers(prev => prev.filter(l => l.qty > 0).map(l => ({ ...l, removing: false })));
    }, 800);
  };

  return (
    <div className="my-8 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[var(--bg-color)] overflow-hidden shadow-sm">

      {/* Method Selection */}
      <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs uppercase tracking-wider font-semibold text-neutral-500">
            Valuation Method
          </span>
          <Button
            onClick={handleReset}
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            <RotateCcw size={12} className="mr-1.5" />
            Reset
          </Button>
        </div>
        <div className="flex gap-2">
          {(['FIFO', 'LIFO', 'WAC'] as ValuationMethod[]).map((m) => (
            <button
              key={m}
              onClick={() => handleMethodChange(m)}
              className={`
                px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 border cursor-pointer
                ${method === m
                  ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 border-neutral-900 dark:border-neutral-100'
                  : 'bg-white dark:bg-[var(--bg-color)] text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                }
              `}
            >
              {m}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          {method === 'FIFO' && 'First-In-First-Out: Oldest inventory is sold first.'}
          {method === 'LIFO' && 'Last-In-First-Out: Newest inventory is sold first.'}
          {method === 'WAC' && 'Weighted Average Cost: Inventory is blended into a single cost.'}
        </p>
      </div>

      {/* Summary Metrics */}
      <div className="px-6 py-6 grid grid-cols-2 gap-4 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <span className="block text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-1">
            Inventory Value
          </span>
          <AnimatedMetric value={inventoryValue} skipAnimation={skipMetricAnimation} />
        </div>

        <div>
          <span className="block text-xs uppercase tracking-wider font-semibold text-neutral-500 mb-1">
            Cost of Goods Sold
          </span>
          <AnimatedMetric value={cogs} skipAnimation={skipMetricAnimation} />
        </div>
      </div>

      {/* Cost Layers Visualization */}
      <div className="p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs uppercase tracking-wider font-semibold text-neutral-500">
              Active Layers
            </span>
            <div className="flex gap-4 text-xs font-mono">
              <span className="text-neutral-500">
                Units: <span className="text-neutral-900 dark:text-neutral-100">{totalUnits}</span>
              </span>
              <span className="text-neutral-500">
                Avg: <span className="text-neutral-900 dark:text-neutral-100">${avgCost}</span>
              </span>
            </div>
          </div>

          <div className="space-y-1">
            {layers.length === 0 ? (
              <div className="h-24 flex items-center justify-center rounded-md border border-dashed border-neutral-200 dark:border-neutral-800">
                <span className="text-sm text-neutral-400">No inventory remaining</span>
              </div>
            ) : (
              layers.map((layer, index) => (
                <LayerBar
                  key={layer.id}
                  layer={layer}
                  index={index}
                  method={method}
                  maxQty={Math.max(...layers.map(l => l.qty))}
                />
              ))
            )}
          </div>
        </div>

        {/* Max Layers Warning */}
        {showMaxLayersWarning && (
          <div className="mb-4 p-3 rounded-md bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 flex items-center gap-2">
            <AlertCircle size={14} className="text-orange-600 dark:text-orange-500" />
            <span className="text-xs text-orange-800 dark:text-orange-200">
              Maximum of {MAX_LAYERS} unique cost layers reached.
            </span>
          </div>
        )}

        {/* Controls */}
        <div className="grid grid-cols-2 gap-6">
          {/* Receive Section */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] uppercase tracking-wider font-medium text-neutral-500 mb-1.5">
                  Qty
                </label>
                <input
                  type="number"
                  value={qtyToReceive}
                  onChange={(e) => setQtyToReceive(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value)))}
                  className="w-full px-3 py-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[var(--bg-color)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 transition-all"
                  min="1"
                />
              </div>

              <div className="flex-1">
                <label className="block text-[10px] uppercase tracking-wider font-medium text-neutral-500 mb-1.5">
                  Cost ($)
                </label>
                <input
                  type="number"
                  value={costPerUnit}
                  onChange={(e) => setCostPerUnit(e.target.value === '' ? '' : Math.max(0, parseFloat(e.target.value)))}
                  className="w-full px-3 py-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[var(--bg-color)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 transition-all"
                  min="0.01"
                  step="0.01"
                />
              </div>
            </div>

            <Button
              onClick={handleReceive}
              disabled={!isReceiveValid}
              className="w-full h-9 text-xs font-medium bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Package size={14} className="mr-2" />
              Receive Stock
            </Button>
          </div>

          {/* Ship Section */}
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium text-neutral-500 mb-1.5">
                Ship Qty
              </label>
              <input
                type="number"
                value={qtyToShip}
                onChange={(e) => setQtyToShip(e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value)))}
                className="w-full px-3 py-2 rounded-md border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[var(--bg-color)] text-sm font-mono focus:outline-none focus:ring-2 focus:ring-neutral-200 dark:focus:ring-neutral-800 transition-all"
                min="1"
              />
            </div>

            <Button
              onClick={handleShip}
              variant="outline"
              className="w-full h-9 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!isShipValid}
            >
              <Send size={14} className="mr-2" />
              Ship Stock
            </Button>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-800">
          <p className="text-xs text-center text-neutral-500">
            Cost is always tracked per SKU. Each product keeps its own cost layers.
          </p>
        </div>
      </div>
    </div>
  );
}
