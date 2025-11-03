"use client"

import { Settings, SettingsSection, SettingsSubSection } from "@/components/app-settings"
import { TeamMemberRow } from "./components/team-member-row"
import { InviteModal } from "./components/invite-modal"
import { EmptyTeamState } from "./components/empty-team-state"
import { useState } from "react"
import { Button } from "@/components/ui/button"

const DUMMY_TEAM_MEMBERS = [
    {
      firstName: "Michael",
      lastName: "Chen",
      email: "michael.chen@company.com",
      role: "Owner"
    },
    {
      firstName: "Emma",
      lastName: "Williams",
      email: "emma.williams@company.com",
      role: "Member"
    },
    {
      firstName: "James",
      lastName: "Rodriguez",
      email: "james.r@company.com",
    },
    {
      firstName: "Olivia",
      lastName: "Taylor",
      email: "olivia.taylor@company.com",
      role: "Moderator"
    }
]

export default function TeamAccessPage() {
  const [isOpen, setIsOpen] = useState(false)
  const hasMembers = DUMMY_TEAM_MEMBERS.length > 0

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
          {!hasMembers ? (
            <EmptyTeamState 
            />
          ) : (
            DUMMY_TEAM_MEMBERS.map((member) => (
              <TeamMemberRow
                key={member.email}
                firstName={member.firstName}
                lastName={member.lastName}
                email={member.email}
                role={member.role ?? "Member"}
              />
            ))
          )}
        </SettingsSubSection>
        
        <InviteModal isOpen={isOpen} onOpenChange={setIsOpen} />

        {/* Access & Permissions Stub */}
        <SettingsSubSection title="Access & Permissions">
          <div>
            <p className="text-sm text-muted-foreground">Access roles and permissions will be configurable soon.</p>
          </div>
        </SettingsSubSection>
      </SettingsSection>
    </Settings>
  )
}
