"use client"

import type React from "react"
import { useState } from "react"
import { Check, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useGrantAccess } from "@/hooks/use-grant-access"

interface GrantAccessModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

type ModalState = "form" | "success" | "error"

interface ErrorState {
  title: string
  description: string
  icon: "error" | "warning"
}

export function GrantAccessModal({ isOpen, onOpenChange }: GrantAccessModalProps) {
  const [state, setState] = useState<ModalState>("form")
  const [email, setEmail] = useState("")
  const [subscriptionMonths, setSubscriptionMonths] = useState("")
  const [errorState, setErrorState] = useState<ErrorState>({
    title: "Something Went Wrong",
    description: "We couldn't grant access right now. Please try again in a moment.",
    icon: "error"
  })

  const { mutate: grantAccess, isPending } = useGrantAccess()

  const isValidEmail = () => {
    const trimmedEmail = email.trim()
    const atIndex = trimmedEmail.indexOf("@")
    const dotIndex = trimmedEmail.lastIndexOf(".")
    
    return atIndex > 0 && dotIndex > atIndex + 1 && dotIndex < trimmedEmail.length - 1
  }

  const isValidMonths = () => {
    const months = Number.parseInt(subscriptionMonths)
    return !Number.isNaN(months) && months > 0 && months <= 120
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset state after modal closes
    setTimeout(() => {
      setState("form")
      setEmail("")
      setSubscriptionMonths("")
      setErrorState({
        title: "Something Went Wrong",
        description: "We couldn't grant access right now. Please try again in a moment.",
        icon: "error"
      })
    }, 200)
  }

  const handleGrantAnother = () => {
    setState("form")
    setEmail("")
    setSubscriptionMonths("")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim() || !subscriptionMonths.trim()) return

    grantAccess(
      { 
        email: email.trim(),
        subscription_months: Number.parseInt(subscriptionMonths)
      },
      {
        onSuccess: () => {
          setState("success")
        },
        onError: (error: any) => {
          const errorMsg = error?.message || ""
          
          let errorConfig: ErrorState
          
          if (errorMsg.toLowerCase().includes("invalid email")) {
            errorConfig = {
              title: "Invalid Email Address",
              description: "Please check the email address and try again.",
              icon: "warning"
            }
          } else if (errorMsg.toLowerCase().includes("user not found")) {
            errorConfig = {
              title: "User Not Found",
              description: "No user exists with this email address.",
              icon: "warning"
            }
          } else if (errorMsg.toLowerCase().includes("already has access")) {
            errorConfig = {
              title: "User Already Has Access",
              description: "This user already has an active subscription.",
              icon: "warning"
            }
          } else {
            // Unexpected error
            errorConfig = {
              title: "Something Went Wrong",
              description: "We couldn't grant access right now. Please try again later.",
              icon: "error"
            }
          }
          
          setErrorState(errorConfig)
          setState("error")
        },
      },
    )
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
              <DialogTitle className="text-lg font-medium">Grant Access</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Grant subscription access to a user.
              </DialogDescription>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email"
                  placeholder="user@example.com"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isPending}
                  className="mt-2"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="months">Subscription Months</Label>
                <Input 
                  id="months" 
                  type="number"
                  min="1"
                  max="120"
                  placeholder="12"
                  value={subscriptionMonths} 
                  onChange={(e) => setSubscriptionMonths(e.target.value)}
                  disabled={isPending}
                  className="mt-2"
                />
              </div>
              
              <Button 
                type="submit" 
                disabled={isPending || !isValidEmail() || !isValidMonths()} 
                className="w-full"
              >
                {isPending ? "Granting Access..." : "Grant Access"}
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
                <DialogTitle className="text-lg font-medium">Access Granted</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  Successfully granted {subscriptionMonths} month{Number.parseInt(subscriptionMonths) !== 1 ? 's' : ''} of access to {email}.
                </DialogDescription>
              </div>

              <div className="flex gap-2 pt-4 w-full">
                <Button variant="outline" onClick={handleGrantAnother} className="flex-1 bg-transparent">
                  Grant Another
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
                  <div className={`absolute w-20 h-20 rounded-full ${
                    errorState.icon === "warning" ? "bg-amber-500/20" : "bg-red-500/20"
                  } animate-in fade-in zoom-in-50 duration-500`} />
                  
                  {/* Inner solid circle with pop animation */}
                  <div className={`flex items-center justify-center w-14 h-14 rounded-full ${
                    errorState.icon === "warning" ? "bg-amber-500" : "bg-red-500"
                  } shadow-md animate-icon-pop opacity-0`}>
                    {errorState.icon === "warning" ? (
                      <span className="text-white text-4xl font-bold leading-none">!</span>
                    ) : (
                      <X className="w-8 h-8 text-white stroke-[4] animate-stroke-draw" />
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <DialogTitle className="text-lg font-medium">{errorState.title}</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  {errorState.description}
                </DialogDescription>
              </div>

              <div className="flex gap-2 pt-4 w-full">
                <Button variant="outline" onClick={handleClose} className="flex-1 bg-transparent">
                  Cancel
                </Button>
                <Button onClick={handleGrantAnother} className="flex-1">
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
