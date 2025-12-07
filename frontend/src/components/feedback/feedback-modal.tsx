"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Check, X } from "lucide-react"
import { useSubmitFeedback } from "@/hooks/use-submit-feedback"
import { MessageText } from "iconoir-react"

interface FeedbackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const CATEGORIES = [
  { value: "bug", label: "Report a Bug" },
  { value: "feature", label: "Feature Request" },
  { value: "improvement", label: "General Improvement" },
  { value: "other", label: "Other" },
]

export function FeedbackModal({ open, onOpenChange }: FeedbackModalProps) {
  const submitFeedback = useSubmitFeedback()
  
  // Form State
  const [message, setMessage] = React.useState("")
  const [category, setCategory] = React.useState("")

  const MIN_LENGTH = 20
  const isTooShort = message.trim().length < MIN_LENGTH
  
  // UI State
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [isError, setIsError] = React.useState(false)

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setMessage("")
        setCategory("")
        setIsSuccess(false)
        setIsError(false)
        submitFeedback.reset()
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [open])
  const handleSubmit = async () => {
    if (!message) return
    
    try {
      await submitFeedback.mutateAsync({
        message,
        category: category || "other",
      })
      setIsSuccess(true)
    } catch (error) {
      console.error(error)
      setIsError(true)
    }
  }

  const handleClose = () => onOpenChange(false)
  
  const handleRetry = () => {
    setIsError(false)
    submitFeedback.reset()
  }

  // SHARED ANIMATION STYLES
  const animationStyles = `
    @keyframes linear-draw {
      0% { stroke-dashoffset: 100; opacity: 0; }
      100% { stroke-dashoffset: 0; opacity: 1; }
    }
    @keyframes spring-pop {
      0% { transform: scale(0.8); opacity: 0; }
      40% { transform: scale(1.08); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    .animate-stroke-draw path, .animate-stroke-draw line, .animate-stroke-draw polyline {
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
      animation: linear-draw 0.6s cubic-bezier(0.65, 0, 0.35, 1) 0.15s forwards;
    }
    .animate-icon-pop {
      animation: spring-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
  `

  // ERROR STATE
  if (isError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[420px]">
          <style dangerouslySetInnerHTML={{__html: animationStyles}} />
          <div className="flex flex-col items-center text-center space-y-2 pt-6 pb-2">
            <div className="p-2 mb-2">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-20 h-20 rounded-full bg-red-500/20 animate-in fade-in zoom-in-50 duration-500" />
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500 shadow-md animate-icon-pop opacity-0">
                  <X className="w-8 h-8 text-white stroke-[4] animate-stroke-draw" />
                </div>
              </div>
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
              Submission Failed
            </DialogTitle>
            <p className="text-sm text-muted-foreground max-w-[300px] mx-auto pb-4">
              Something went wrong while sending your feedback. Please try again.
            </p>
            <div className="flex gap-3 w-full pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Close
              </Button>
              <Button onClick={handleRetry} className="flex-1">
                Try Again
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // SUCCESS STATE
  if (isSuccess) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[420px]">
          <style dangerouslySetInnerHTML={{__html: animationStyles}} />
          <div className="flex flex-col items-center text-center space-y-2 pt-6 pb-2">
            <div className="p-2 mb-2">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-20 h-20 rounded-full bg-green-500/20 animate-in fade-in zoom-in-50 duration-500" />
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-500 shadow-md animate-icon-pop opacity-0">
                  <Check className="w-8 h-8 text-white stroke-[4] animate-stroke-draw" />
                </div>
              </div>
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Feedback Sent
            </DialogTitle>
            <p className="text-sm text-muted-foreground max-w-[300px] mx-auto pb-4">
              Thanks for helping us improve! We've received your feedback and will look into it.
            </p>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // MAIN FORM
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
            <MessageText className="w-5 h-5 text-muted-foreground" />
            Send Feedback
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category" className="mt-1 cursor-pointer">
                <SelectValue placeholder="Select a topic..." />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        <div className="space-y-2">
        <div className="flex justify-between">
            <Label htmlFor="message">Details</Label>
            <span className="text-[10px] text-muted-foreground">
            {message.length}/1000
            </span>
        </div>

        <Textarea 
            id="message"
            placeholder="Tell us what's on your mind..."
            className="min-h-[120px] resize-none text-sm mt-2"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
        />

        {isTooShort && (
            <p className="text-xs">
            Please enter at least {MIN_LENGTH} characters.
            </p>
        )}
        </div>
        </div>

        <div className="flex justify-end gap-2 mt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitFeedback.isPending}
          >
            Cancel
          </Button>

          <Button
            onClick={handleSubmit}
            disabled={!message || submitFeedback.isPending}
            className="min-w-[100px]"
          >
            {submitFeedback.isPending ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Sending...
              </>
            ) : (
              "Submit"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
