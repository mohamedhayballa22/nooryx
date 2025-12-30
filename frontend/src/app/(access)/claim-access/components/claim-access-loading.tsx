"use client"

import { Loader2 } from "lucide-react"

export function ClaimAccessLoading() {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <p className="text-muted-foreground text-sm">Validating access token...</p>
    </div>
  )
}