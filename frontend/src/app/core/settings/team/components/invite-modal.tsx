"use client"

import type React from "react"
import { useState } from "react"
import { Check, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useInvite } from "@/hooks/use-invite"

interface InviteModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

type ModalState = "form" | "success" | "error"

interface ErrorState {
  title: string
  description: string
  icon: "error" | "warning"
}

export function InviteModal({ isOpen, onOpenChange }: InviteModalProps) {
  const [state, setState] = useState<ModalState>("form")
  const [email, setEmail] = useState("")
  const [errorState, setErrorState] = useState<ErrorState>({
    title: "Something Went Wrong",
    description: "We couldn't send the invitation right now. Please try again in a moment.",
    icon: "error"
  })

  const { mutate: sendInvite, isPending } = useInvite()

  const isValidEmail = () => {
    const trimmedEmail = email.trim()
    const atIndex = trimmedEmail.indexOf("@")
    const dotIndex = trimmedEmail.lastIndexOf(".")
    
    return atIndex > 0 && dotIndex > atIndex + 1 && dotIndex < trimmedEmail.length - 1
  }

  const handleClose = () => {
    onOpenChange(false)
    // Reset state after modal closes
    setTimeout(() => {
      setState("form")
      setEmail("")
      setErrorState({
        title: "Something Went Wrong",
        description: "We couldn't send the invitation right now. Please try again in a moment.",
        icon: "error"
      })
    }, 200)
  }

  const handleInviteAnother = () => {
    setState("form")
    setEmail("")
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) return

    sendInvite(
      { email: email.trim() },
      {
        onSuccess: () => {
          setState("success")
        },
        onError: (error: any) => {
          const errorMsg = error?.message || ""
          console.log(errorMsg)
          
          let errorConfig: ErrorState
          
          if (errorMsg.toLowerCase().includes("invalid email")) {
            errorConfig = {
              title: "Invalid Email Address",
              description: "Please check the email address and try again.",
              icon: "warning"
            }
          } else if (errorMsg.toLowerCase().includes("cannot invite yourself")) {
            errorConfig = {
              title: "Can't Invite Yourself",
              description: "You're already part of this workspace. Try inviting a colleague instead.",
              icon: "warning"
            }
          } else if (errorMsg.toLowerCase().includes("already a member")) {
            errorConfig = {
              title: "Already a Member",
              description: "This user is already part of your workspace.",
              icon: "warning"
            }
          } else {
            // Unexpected error
            errorConfig = {
              title: "Something Went Wrong",
              description: "We couldn't send the invitation right now. Please try again later.",
              icon: "error"
            }
          }
          
          setErrorState(errorConfig)
          setState("error")
        },
      },
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {state === "form" ? (
          <>
            <div className="space-y-2">
              <DialogTitle className="text-lg font-medium">Invite User</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Send an invitation to join your workspace.
              </DialogDescription>
            </div>
            
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email"
                  placeholder="colleague@example.com"
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isPending}
                  className="mt-2"
                />
              </div>
              <Button type="submit" disabled={isPending || !isValidEmail()} className="w-full">
                {isPending ? "Inviting..." : "Invite"}
              </Button>
            </form>
          </>
        ) : state === "success" ? (
          <>
            <div className="flex flex-col items-center text-center space-y-4 py-6">
              <div className="p-2">
                <div className="relative flex items-center justify-center">
                  {/* Outer translucent ring */}
                  <div className="absolute w-20 h-20 rounded-full bg-green-500/20" />
                  
                  {/* Inner solid circle */}
                  <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-500">
                    <Check className="w-8 h-8 text-white stroke-[4]" />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <DialogTitle className="text-lg font-medium">Invitation Sent</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground">
                  We've sent an invitation to {email}. They'll receive it shortly.
                </DialogDescription>
              </div>

              <div className="flex gap-2 pt-4 w-full">
                <Button variant="outline" onClick={handleInviteAnother} className="flex-1 bg-transparent">
                  Invite Another
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
                  {/* Outer translucent ring */}
                  <div className={`absolute w-20 h-20 rounded-full ${
                    errorState.icon === "warning" ? "bg-amber-500/20" : "bg-red-500/20"
                  }`} />
                  
                  {/* Inner solid circle */}
                  <div className={`flex items-center justify-center w-14 h-14 rounded-full ${
                    errorState.icon === "warning" ? "bg-amber-500" : "bg-red-500"
                  }`}>
                    {errorState.icon === "warning" ? (
                      <span className="text-white text-4xl font-bold leading-none">!</span>
                    ) : (
                      <X className="w-8 h-8 text-white stroke-[4]" />
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
