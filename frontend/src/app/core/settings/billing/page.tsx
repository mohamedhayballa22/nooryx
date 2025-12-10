"use client"

import { Button } from "@/components/ui/button"
import { Settings, SettingsSection, SettingsSubSection, SettingRow, SettingsSkeleton } from "@/components/app-settings"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useUserAccount } from "../account/hooks/use-account"

export default function BillingSettings() {
  const { data, error, isLoading } = useUserAccount()

  if (isLoading || !data) {
    return <SettingsSkeleton />
  }

  if (error) {
    return (
      <Settings>
        <SettingsSection>
          <div className="flex items-center justify-center py-8">
            <p className="text-destructive">
              Failed to load billing and plan information. Please try again later.
            </p>
          </div>
        </SettingsSection>
      </Settings>
    )
  }

  // Defensive: ensure subscription exists with safe defaults
  const subscription = data.subscription ?? {
    plan_name: "free",
    status: "active",
    current_period_end: ""
  }

  const planName = subscription.plan_name || "free"
  const status = subscription.status || "active"
  const isFree = planName.toLowerCase() === "free"
  const isActive = status === "active"
  const isPaidPlan = !isFree && isActive

  // Format plan name for display
  const displayPlanName = planName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  // Determine badge styling
  const getBadgeStyle = () => {
    if (status === "active") {
      return "border-transparent bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300"
    }
    if (status === "payment_failed") {
      return "border-transparent bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
    }
    return "border-transparent bg-gray-200 text-gray-800 dark:bg-gray-600/50 dark:text-gray-300"
  }

  // Format status for display
  const displayStatus = status
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

  // Determine action button
  const getActionButton = () => {
    if (isFree) {
      return <Button size="sm">Upgrade Plan</Button>
    }
    
    if (status === "active") {
      return <Button variant="destructive" size="sm">Cancel Subscription</Button>
    }
    
    if (status === "payment_failed") {
      return <Button variant="outline" size="sm">Update Payment Method</Button>
    }
    
    return <Button size="sm">Renew Subscription</Button>
  }

  return (
    <Settings>
      <SettingsSection>
        <SettingsSubSection
          title="Subscription Overview"
          action={getActionButton()}
        >
          <SettingRow
            label="Plan"
            description="Your current subscription plan"
            control={
              <span className="text-sm font-medium">
                {displayPlanName}
              </span>
            }
            isFirst
          />
          <SettingRow
            label="Status"
            description="Indicates whether your subscription is active"
            control={
              <Badge className={getBadgeStyle()}>
                {displayStatus}
              </Badge>
            }
          />
          <SettingRow
            label="Next Renewal"
            description={isFree ? "Free plans don't expire" : "Your next billing date"}
            control={
              isPaidPlan && subscription.current_period_end ? (
                <span className="text-sm">
                  {format(new Date(subscription.current_period_end), "PPP")}
                </span>
              ) : (
                <span className="text-muted-foreground text-sm">
                  {isFree ? "Never" : "—"}
                </span>
              )
            }
            isLast
          />
        </SettingsSubSection>
      </SettingsSection>
    </Settings>
  )
}
