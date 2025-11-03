"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"

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
  // Generate initials from first and last name
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
  const fullName = `${firstName} ${lastName}`

  // Padding logic matching SettingRow
  const paddingClass = 
    isFirst && isLast 
      ? "py-0" 
      : isFirst 
      ? "pt-0 pb-3" 
      : isLast 
      ? "pt-3 pb-0" 
      : "py-3"

  return (
    <div className={`flex items-center justify-between ${paddingClass}`}>
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback className="text-sm font-medium">
            {initials}
          </AvatarFallback>
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
