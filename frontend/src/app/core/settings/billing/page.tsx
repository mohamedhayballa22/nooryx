"use client"

import { Button } from "@/components/ui/button"
import { Settings, SettingsSection, SettingsSubSection, SettingRow, SettingsSkeleton } from "@/components/app-settings"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import { useUserAccount } from "../account/hooks/use-account"

export default function BillingSettings() {
  const { data, error, isLoading } = useUserAccount()

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
              Failed to load billing and plan information. Please try again later.
            </p>
          </div>
        </SettingsSection>
      </Settings>
    )
  }

  return (
    <Settings>
      <SettingsSection>
        {/* Overview */}
        <SettingsSubSection
          title="Subscription Overview"
          action={data.subscription.status === "active" ? (
            <Button variant="destructive" size="sm">Cancel Subscription</Button>
          ) : data.subscription.status === "payment_failed" ? (
            <Button variant="outline" size="sm">Update Payment Method</Button>
          ) : (
            <Button>Renew Subscription</Button>
          )}
        >
          <SettingRow
            label="Plan"
            description="Your current subscription plan"
            control={
            <span className="text-sm">
              {data.subscription.plan_name.split('_').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
              ).join(' ')}
            </span>
            }
            isFirst
          />
          <SettingRow
            label="Status"
            description="Indicates whether your subscription is active"
            control={
              <Badge className={
                data.subscription.status === "active" ?
                  "border-transparent bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300" :
                data.subscription.status === "payment_failed" ?
                  "border-transparent bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300" :
                  "border-transparent bg-gray-200 text-gray-800 dark:bg-gray-600/50 dark:text-gray-300"
              }>
                {data.subscription.status.replace(/_/g, ' ').charAt(0).toUpperCase() + data.subscription.status.replace(/_/g, ' ').slice(1)}
              </Badge>
            }
          />
          <SettingRow
            label="Next Renewal"
            description="Your next billing date"
            control={
              data.subscription.current_period_end ? (
                <span className="text-sm">{format(new Date(data.subscription.current_period_end), "PPP")}</span>
              ) : (
                <span className="text-muted-foreground text-sm">—</span>
              )
            }
            isLast
          />
        </SettingsSubSection>
      </SettingsSection>
    </Settings>
  )
}
