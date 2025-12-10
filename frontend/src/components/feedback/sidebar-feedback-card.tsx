"use client"

import * as React from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { FeedbackModal } from "./feedback-modal"
import { MessageText } from "iconoir-react"
import { useSidebar } from "@/components/ui/sidebar"

const STORAGE_KEY = "sidebar-feedback-hidden"

export function SidebarFeedbackCard() {
  const [isVisible, setIsVisible] = React.useState(false)
  const [isModalOpen, setIsModalOpen] = React.useState(false)
  const [mounted, setMounted] = React.useState(false)
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  React.useEffect(() => {
    setMounted(true)
    const isHidden = localStorage.getItem(STORAGE_KEY)
    if (!isHidden) {
      setIsVisible(true)
    }
  }, [])

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsVisible(false)
    localStorage.setItem(STORAGE_KEY, "true")
  }

  if (!mounted) return null
  
  if (!isVisible || isCollapsed) {
    return <FeedbackModal open={isModalOpen} onOpenChange={setIsModalOpen} />
  }

  return (
    <>
      <div 
        role="button"
        tabIndex={0}
        onClick={() => setIsModalOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsModalOpen(true)
          }
        }}
        className={cn(
          "group relative mx-2 mb-2 flex flex-col gap-2 rounded-xl border bg-gradient-to-br from-background to-muted/50 p-3 text-sm shadow-sm transition-all hover:shadow-md",
          "hover:border-primary/20 hover:from-background hover:to-muted cursor-pointer"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageText className="h-4 w-4" />
            </div>
            <div className="flex flex-col">
              <span className="font-semibold leading-tight">Feedback?</span>
              <span className="text-[11px] text-muted-foreground">Help us improve.</span>
            </div>
          </div>
          
          <Button
            variant="ghost" 
            size="icon" 
            className="h-6 w-6 -mr-1 -mt-1 text-muted-foreground/50 hover:text-foreground hover:bg-transparent"
            onClick={handleDismiss}
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      </div>

      <FeedbackModal open={isModalOpen} onOpenChange={setIsModalOpen} />
    </>
  )
}
