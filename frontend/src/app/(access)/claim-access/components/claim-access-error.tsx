"use client"

import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

interface ClaimAccessErrorProps {
  title?: string
  message?: string
}

export function ClaimAccessError({
  title = "Invalid access token",
  message = "This access link is invalid or has expired. Please contact support if you believe this is an error.",
}: ClaimAccessErrorProps) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-950">
        <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground text-sm text-balance max-w-sm">{message}</p>
      </div>
      <Button asChild variant="outline">
        <Link href="/login">Go to login</Link>
      </Button>
    </div>
  )
}
