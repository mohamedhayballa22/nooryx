"use client"

import * as React from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

export function SearchTrigger() {
  const [isMac, setIsMac] = React.useState(false)

  React.useEffect(() => {
    // Detect OS
    setIsMac(navigator.platform.toUpperCase().indexOf('MAC') >= 0)
  }, [])

  const handleClick = () => {
    // Simulate Ctrl/Cmd + K keyboard event
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      code: 'KeyK',
      metaKey: isMac,
      ctrlKey: !isMac,
      bubbles: true,
      cancelable: true
    })
    document.dispatchEvent(event)
  }

  const modifierKey = isMac ? "⌘" : "ctrl"

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      className={cn(
        "relative flex min-w-60 items-center justify-between rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground shadow-xs",
        "hover:cursor-text hover:bg-accent/50 transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
    >
      <div className="flex items-center">
        <Search className="mr-2 h-4 w-4 text-muted-foreground/70" />
        <span className="text-muted-foreground text-sm">Search docs...</span>
      </div>
      
      {/* Hide keyboard shortcuts on mobile */}
      <div className="hidden sm:flex items-center gap-1">
        <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none">
          {modifierKey}
        </kbd>
        <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none">
          k
        </kbd>
      </div>
    </div>
  )
}
