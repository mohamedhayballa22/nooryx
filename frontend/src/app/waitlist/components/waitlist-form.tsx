"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check } from "lucide-react"
import { useJoinWaitlist } from "@/hooks/use-waitlist"

const WAITLIST_STORAGE_KEY = "nooryx_waitlist_joined"

export function WaitlistForm() {
  const [email, setEmail] = useState("")
  const [mounted, setMounted] = useState(false)
  const [isReturningUser, setIsReturningUser] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const { mutate, isPending, isSuccess, isError, error } = useJoinWaitlist()

  useEffect(() => {
    setMounted(true)
    const hasJoined = localStorage.getItem(WAITLIST_STORAGE_KEY)
    if (hasJoined === "true") {
      setHasSubmitted(true)
      setIsReturningUser(true)
    }
  }, [])

  useEffect(() => {
    if (isSuccess && !isReturningUser) {
      try {
        localStorage.setItem(WAITLIST_STORAGE_KEY, "true")
      } catch (error) {
        // localStorage unavailable, continue without persistence
        }
    setHasSubmitted(true)
    }
  }, [isSuccess, isReturningUser])

  const isValidEmail = () => {
    const trimmedEmail = email.trim()
    const atIndex = trimmedEmail.indexOf("@")
    const dotIndex = trimmedEmail.lastIndexOf(".")
    return atIndex > 0 && dotIndex > atIndex + 1 && dotIndex < trimmedEmail.length - 1
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isValidEmail()) {
      return
    }

    setIsReturningUser(false)
    mutate({ email: email.trim().toLowerCase() })
  }

  // Prevent hydration mismatch
  if (!mounted) {
    return null
  }

  // Show success if either: localStorage says they joined OR fresh submission succeeded
  if (hasSubmitted || isSuccess) {
    return (
      <div className="flex flex-col items-center text-center space-y-4 py-6">
        <style
          dangerouslySetInnerHTML={{
            __html: `
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
            `,
          }}
        />

        <div className="p-2">
          <div className="relative flex items-center justify-center">
            {/* Outer translucent ring */}
            <div className="absolute w-20 h-20 rounded-full bg-green-500/20 animate-in fade-in zoom-in-50 duration-500" />

            {/* Inner solid circle with check */}
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-500 shadow-md animate-icon-pop opacity-0">
              <Check className="w-8 h-8 text-white stroke-[4] animate-stroke-draw" />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl font-bold">
            {isReturningUser ? "You're already on the list" : "You're on the list."}
          </h1>
          <p className="text-muted-foreground text-sm text-balance">
            {isReturningUser
              ? "We have your information and will notify you when we're ready to onboard more users."
              : "Thanks for your interest. We'll notify you when we're ready to onboard more users."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-bold">Early access to Nooryx</h1>
        <p className="text-muted-foreground text-sm text-balance">
          We're currently onboarding a small number of teams. Join the
          waitlist and we'll notify you as soon as we're ready to onboard more users.
        </p>
      </div>

      {isError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error?.message || "Failed to join waitlist. Please try again."}
        </div>
      )}

      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="you@company.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isPending}
          className="mt-1"
        />
      </div>

      <Button 
        type="submit" 
        className="cursor-pointer" 
        disabled={isPending || !isValidEmail()}
      >
        {isPending ? "Joining..." : "Join waitlist"}
      </Button>
    </form>
  )
}
