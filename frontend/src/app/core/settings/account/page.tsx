"use client"

import { useState } from "react"
import { formatDistanceToNow, format } from "date-fns"
import { SmartphoneDevice, Laptop, Trash, EditPencil } from "iconoir-react"
import {
  Settings,
  SettingsSection,
  SettingsSubSection,
  SettingRow,
  SettingsSkeleton,
} from "@/components/app-settings"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useDeleteSession, useUserAccount } from "./hooks/use-account"
import { UAParser } from 'ua-parser-js'
import { SettingsEditDialog } from "../components/settings-edit-dialog"
import { DeleteAccountDialog } from "../components/delete-account"
import { toast } from "sonner"

// Device Parser
function parseDeviceInfo(ua: string | null) {
  if (!ua) return { os: "Unknown", browser: "Browser", device: "Unknown" }
  
  const parser = new UAParser(ua)
  const result = parser.getResult()
  
  return {
    os: result.os.name || "Unknown",
    browser: result.browser.name || "Browser",
    device: result.device.type || "desktop", // mobile, tablet, desktop, etc.
  }
}


export default function AccountSecurityPage() {
  const { data, error, isLoading } = useUserAccount()
  const [editRoleOpen, setEditRoleOpen] = useState(false)
  const [deleteSessionOpen, setDeleteSessionOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false)

  const { mutate } = useDeleteSession();

  const handleSessionDelete = (sessionId: string) => {
    mutate(sessionId, {
      onSuccess: () => {
        toast.success("Session ended successfully")
      },
      onError: () => {
        toast.error("Failed to end session")
      },
    });
  };

  const handleAccountDelete = () => {
    // TODO: Implement account deletion API call
    console.log("Deleting account for:", user.email)
  }

  const openDeleteSession = (sessionId: string) => {
    setSelectedSession(sessionId)
    setDeleteSessionOpen(true)
  }

  if (isLoading || !data) {
    return (
      <SettingsSkeleton />
    )
  }

  if (error) {
    return (
      <Settings>
        <SettingsSection>
          <div className="flex items-center justify-center py-8">
            <p className="text-destructive">
              Failed to load account information. Please try again later.
            </p>
          </div>
        </SettingsSection>
      </Settings>
    )
  }

  const { user, organization, sessions } = data

  return (
    <>
      <Settings>
        <SettingsSection>
          {/* Account Info */}
          <SettingsSubSection title="Account information">
            <SettingRow
              label="Full name"
              description="Your first and last name"
              control={
                <span className="text-sm">
                  {user.first_name} {user.last_name}
                </span>
              }
            />
            <SettingRow
              label="Email"
              description="Used for login"
              control={<span className="text-sm">{user.email}</span>}
            />
            <SettingRow
              label="Role"
              description="Your job title or function"
              control={
                <div className="flex items-center gap-2">
                  <span className="text-sm">{user.role || ""}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => setEditRoleOpen(true)}
                  >
                    <EditPencil className="h-4 w-4" />
                  </Button>
                </div>
              }
            />
            <SettingRow
              label="Member since"
              description="When your account was created"
              control={<span className="text-sm">{format(new Date(user.created_at), "PPP")}</span>}
            />
          </SettingsSubSection>

          {/* Organization Info */}
          <SettingsSubSection title="Organization">
            <SettingRow 
              label="Organization name" 
              control={<span className="text-sm">{organization.name}</span>} 
            />
            <SettingRow
              label="Created on"
              control={<span className="text-sm">{format(new Date(organization.created_at), "PPP")}</span>}
            />
          </SettingsSubSection>

          {/* Active Sessions */}
          <SettingsSubSection title="Active sessions" unstyled>
            <div className="border rounded-md overflow-hidden">
              {sessions.map((sess, index) => {
                const { os, browser } = parseDeviceInfo(sess.device_info)
                const isCurrent = sess.is_current
                const isMobile = sess.device_info ? /iphone|android/i.test(sess.device_info) : false
                const Icon = isMobile ? SmartphoneDevice : Laptop

                return (
                  <div key={sess.id}>
                    <div className="flex justify-between items-center p-4 transition-colors">
                      <div className="flex items-start gap-3">
                        <Icon className={cn("mt-1 text-muted-foreground", isMobile ? "h-6 w-6 -ml-0.5" : "h-5 w-5")} />
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {os} • {browser}
                            </span>
                            {isCurrent && (
                              <Badge
                                variant="secondary"
                                className="border-transparent bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
                              >
                                This device
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {isCurrent
                              ? "Active now"
                              : sess.last_used_at
                                ? `Last used ${formatDistanceToNow(new Date(sess.last_used_at), {
                                    addSuffix: true,
                                  })}`
                                : "Never used"}{" "}
                            {sess.ip_address && `— IP ${sess.ip_address}`}
                          </span>
                          {!isCurrent && (
                            <span className="text-sm text-muted-foreground">
                              Expires {format(new Date(sess.expires_at), "PPP")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Only show trash icon if this is NOT the current device */}
                      {!isCurrent && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:text-foreground hover:text-red-500 transition-colors"
                          onClick={() => openDeleteSession(sess.id)}
                        >
                          <Trash className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                    {index < sessions.length - 1 && <div className="border-b border-border mx-4" />}
                  </div>
                )
              })}
            </div>
          </SettingsSubSection>

          {/* Danger Zone */}
          <SettingsSubSection title="Danger zone" unstyled>
            <div className="border border-destructive/50 rounded-md p-4">
              <SettingRow
                label="Delete account"
                description="This action cannot be undone. Your account and all its data will be permanently removed."
                control={
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteAccountOpen(true)}
                  >
                    Delete account
                  </Button>
                }
              />
            </div>
          </SettingsSubSection>

          {/* Delete Account Dialog */}
          <DeleteAccountDialog
            open={deleteAccountOpen}
            onOpenChange={setDeleteAccountOpen}
            email={user.email}
            onConfirm={handleAccountDelete}
          />
        </SettingsSection>
      </Settings>

      {/* Edit Role Dialog */}
      <SettingsEditDialog
        open={editRoleOpen}
        onOpenChange={setEditRoleOpen}
        title="Edit role"
        description="Update your job title or function"
        initialValue={user.role || ""}
        settingKey="role"
      >
        {(value, onChange) => (
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g., Inventory Manager"
          />
        )}
      </SettingsEditDialog>

      {/* Delete Session Dialog */}
      <SettingsEditDialog
        open={deleteSessionOpen}
        onOpenChange={setDeleteSessionOpen}
        title="End session"
        description="Are you sure you want to end this session? You will be logged out on that device."
        onDelete={() => selectedSession && handleSessionDelete(selectedSession)}
      />
    </>
  )
}
