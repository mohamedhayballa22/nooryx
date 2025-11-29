"use client"

import type React from "react"
import { useState } from "react"
import { Check, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface InviteModalDemoProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

type ModalState = "form" | "success" | "error"

export function InviteModalDemo({ isOpen, onOpenChange }: InviteModalDemoProps) {
  const [state, setState] = useState<ModalState>("form")
  const [email, setEmail] = useState("")

  const isValidEmail = (email: string): boolean => {
    const trimmed = email.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(trimmed)
  }

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(() => {
      setState("form")
      setEmail("")
    }, 200)
  }

  const handleInviteAnother = () => {
    setState("form")
    setEmail("")
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Simulate processing delay
    setTimeout(() => {
      if (isValidEmail(email)) {
        setState("success")
      } else {
        setState("error")
      }
    }, 500)
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {/* Inject animation styles */}
        {state !== "form" && <style dangerouslySetInnerHTML={{__html: animationStyles}} />}
        
        {state === "form" ? (
          <>
            <div className="space-y-2">
              <DialogTitle className="text-lg font-medium">Invite New Member</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Try entering a valid or invalid email to see the different states.
              </DialogDescription>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="text"
                  placeholder="colleague@example.com"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2"
                />
              </div>
              <Button type="submit" className="w-full">
                Invite
              </Button>
            </form>
          </>
        ) : state === "success" ? (
          <>
            <div className="flex flex-col items-center text-center space-y-4 py-6">
              <div className="p-2">
                <div className="relative flex items-center justify-center">
                  {/* Outer translucent ring with fade-in animation */}
                  <div className="absolute w-20 h-20 rounded-full bg-green-500/20 animate-in fade-in zoom-in-50 duration-500" />
                  
                  {/* Inner solid circle with pop animation */}
                  <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-500 shadow-md animate-icon-pop opacity-0">
                    <Check className="w-8 h-8 text-white stroke-[4] animate-stroke-draw" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <DialogTitle className="text-lg font-medium">Invite Successful</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  In Nooryx, {email} would receive an invitation email. This is just a demo!
                </DialogDescription>
              </div>

              <div className="flex gap-2 pt-4 w-full">
                <Button variant="outline" onClick={handleInviteAnother} className="flex-1 bg-transparent">
                  Try Again
                </Button>
                <Button onClick={handleClose} className="flex-1">
                  Done
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center text-center space-y-4 py-6">
              <div className="p-2">
                <div className="relative flex items-center justify-center">
                  {/* Outer translucent ring with fade-in animation */}
                  <div className="absolute w-20 h-20 rounded-full bg-amber-500/20 animate-in fade-in zoom-in-50 duration-500" />
                  
                  {/* Inner solid circle with pop animation */}
                  <div className="flex items-center justify-center w-14 h-14 rounded-full bg-amber-500 shadow-md animate-icon-pop opacity-0">
                    <span className="text-white text-4xl font-bold leading-none">!</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <DialogTitle className="text-lg font-medium">Invalid Email</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Please enter a valid email address. Don't worry, we won't send any emails in this demo.
                </DialogDescription>
              </div>

              <div className="flex gap-2 pt-4 w-full">
                <Button variant="outline" onClick={handleClose} className="flex-1 bg-transparent">
                  Cancel
                </Button>
                <Button onClick={handleInviteAnother} className="flex-1">
                  Try Again
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
