"use client"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface TeamMemberRowProps {
  firstName: string
  lastName: string
  email: string
  role: string
  isFirst?: boolean
  isLast?: boolean
}

export function TeamMemberRow({
  firstName,
  lastName,
  email,
  role,
  isFirst,
  isLast,
}: TeamMemberRowProps) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  const fullName = `${firstName} ${lastName}`

  const paddingClass =
    isFirst && isLast
      ? "py-0"
      : isFirst
      ? "pt-0 pb-3"
      : isLast
      ? "pt-3 pb-0"
      : "py-3"

  return (
    <div className={cn("flex items-center justify-between", paddingClass)}>
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <div className="flex h-full w-full items-center justify-center text-sm font-medium">
            {initials}
          </div>
        </Avatar>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{fullName}</span>
          <span className="text-sm text-muted-foreground">{email}</span>
        </div>
      </div>
      <Badge variant="secondary">{role}</Badge>
    </div>
  )
}

/**
 * Skeleton version of TeamMemberRow
 * visually matches layout and spacing but uses gray placeholders
 */
TeamMemberRow.Skeleton = function TeamMemberRowSkeleton({
  isFirst,
  isLast,
}: {
  isFirst?: boolean
  isLast?: boolean
}) {
  const paddingClass =
    isFirst && isLast
      ? "py-0"
      : isFirst
      ? "pt-0 pb-3"
      : isLast
      ? "pt-3 pb-0"
      : "py-3"

  return (
    <div className={cn("flex items-center justify-between", paddingClass)}>
      <div className="flex items-center gap-3">
        {/* Avatar placeholder */}
        <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
        <div className="flex flex-col gap-1">
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          <div className="h-3 w-44 rounded bg-muted/80 animate-pulse" />
        </div>
      </div>
      {/* Badge placeholder */}
      <div className="h-6 w-16 rounded bg-muted animate-pulse" />
    </div>
  )
}
