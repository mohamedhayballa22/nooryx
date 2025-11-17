'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'

export default function AlertsLegend() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="Show alert severity levels information"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <Info size={14} />
        <span>Alert levels</span>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-20 w-64 rounded-lg border border-border bg-card shadow-lg p-4">
            <h3 className="text-xs font-medium text-foreground mb-3">
              Alert severity levels
            </h3>
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Info</p>
                  <p className="text-xs text-muted-foreground">General updates</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Warning</p>
                  <p className="text-xs text-muted-foreground">Needs attention</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="h-2 w-2 rounded-full bg-red-500 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium text-foreground">Critical</p>
                  <p className="text-xs text-muted-foreground">Action needed</p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
