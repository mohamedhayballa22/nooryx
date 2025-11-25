'use client'

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { InviteModalDemo } from "./invite-modal-demo"
import { useState } from "react"

export function EmptyTeamStateDemo() {
  const [isOpen, setIsOpen] = useState(false)
  const placeholders = [
    { 
      style: {
        background: `
          radial-gradient(circle at 20% 50%, rgba(19, 60, 125, 0.8) 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, rgba(249, 255, 238, 0.89) 0%, transparent 50%),
          radial-gradient(circle at 40% 20%, rgba(69, 188, 243, 0.6) 0%, transparent 50%),
          linear-gradient(180deg, #47618cff 0%, #0f172a 100%)
        `
      }
    },
    { 
      style: {
        background: `
          radial-gradient(circle at 30% 30%, rgba(251, 191, 36, 1) 0%, transparent 50%),
          radial-gradient(circle at 70% 70%, rgba(239, 68, 68, 1) 0%, transparent 50%),
          radial-gradient(circle at 50% 90%, rgba(245, 158, 11, 1) 0%, transparent 50%),
          linear-gradient(135deg, #e75322ff 0%, #eb2a2aff 100%)
        `
      }
    },
    { 
      style: {
        background: `
          radial-gradient(circle at 40% 40%, rgba(13, 151, 105, 0.8) 0%, transparent 50%),
          radial-gradient(circle at 80% 20%, rgba(28, 254, 228, 0.7) 0%, transparent 50%),
          radial-gradient(circle at 20% 80%, rgba(44, 178, 129, 0.83) 0%, transparent 50%),
          linear-gradient(180deg, #0db387ff 0%, #2cb2a9ff 100%)
        `
      }
    },
  ]

  return (
    <Card className="rounded-md shadow-xs border bg-muted/30">
      <CardContent className="p-8">
        <div className="flex flex-col items-center text-center">
          {/* Avatar Stack */}
          <div className="flex -space-x-2 *:data-[slot=avatar]:size-12 *:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background">
            {placeholders.map((p, i) => (
              <Avatar key={i} data-slot="avatar">
                <AvatarFallback
                  style={p.style}
                  className="text-white font-medium"
                />
              </Avatar>
            ))}
          </div>

          {/* Content */}
          <div >
            <h3 className="text-lg font-semibold">No Team Members yet</h3>
            <p className="text-sm text-muted-foreground">
              Invite your team to collaborate on inventory and operations.
            </p>
          </div>

          {/* Action */}
          <Button size="sm" onClick={() => setIsOpen(true)}>
            Invite New Member
          </Button>
        </div>
        
        <InviteModalDemo isOpen={isOpen} onOpenChange={setIsOpen} />
      </CardContent>
    </Card>
  )
}
