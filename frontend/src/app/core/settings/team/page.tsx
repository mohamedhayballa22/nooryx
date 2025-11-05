"use client"

import { Settings, SettingsSection, SettingsSubSection } from "@/components/app-settings"
import { TeamMemberRow } from "./components/team-member-row"
import { InviteModal } from "./components/invite-modal"
import { EmptyTeamState } from "./components/empty-team-state"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useTeamMembers } from "./hooks/use-members"

export default function TeamAccessPage() {
  const [isOpen, setIsOpen] = useState(false)
  const { data, isLoading } = useTeamMembers()
  const hasMembers = data && data.length > 0

  return (
    <Settings>
      <SettingsSection>
        {/* Team Members Section */}
        <SettingsSubSection 
          title="Team Members"
          action={
            hasMembers ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsOpen(true)}
              >
                Invite New Member
              </Button>
            ) : undefined
          }>
          
          {isLoading ? (
            <div className="flex flex-col">
              {[...Array(3)].map((_, i) => (
                <TeamMemberRow.Skeleton 
                  key={i} 
                  isFirst={i === 0} 
                  isLast={i === 2} 
                />
              ))}
            </div>
          ) : !hasMembers ? (
            <EmptyTeamState />
          ) : (
            data.map((member, i) => (
              <TeamMemberRow
                key={member.email}
                firstName={member.first_name}
                lastName={member.last_name}
                email={member.email}
                role={member.role ?? "Member"}
                isFirst={i === 0}
                isLast={i === data.length - 1}
              />
            ))
          )}
        </SettingsSubSection>
        
        <InviteModal isOpen={isOpen} onOpenChange={setIsOpen} />

        {/* Access & Permissions Stub */}
        <SettingsSubSection title="Access & Permissions">
          <div>
            <p className="text-sm text-muted-foreground">
              Access roles and permissions will be configurable soon.
            </p>
          </div>
        </SettingsSubSection>
      </SettingsSection>
    </Settings>
  )
}
