"use client"

import { Button } from "@/components/ui/button"
import { Settings, SettingsSection, SettingsSubSection, SettingRow } from "@/components/app-settings"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

export default function BillingSettings() {
  const subscription = {
    plan_name: "Nooryx Pro",
    status: "cancelled",
    current_period_end: "2025-11-14T00:00:00Z",
    billing_frequency: "monthly",
  }

  return (
    <Settings>
      <SettingsSection>
        {/* Overview */}
        <SettingsSubSection
          title="Subscription Overview"
          action={subscription.status === "active" ? (
            <Button variant="destructive" size="sm">Cancel Subscription</Button>
          ) : subscription.status === "payment_failed" ? (
            <Button variant="outline" size="sm">Update Payment Method</Button>
          ) : (
            <Button>Renew Subscription</Button>
          )}
        >
          <SettingRow
            label="Plan"
            description="Your current subscription plan"
            control={<span className="text-sm">{subscription.plan_name}</span>}
            isFirst
          />
          <SettingRow
            label="Status"
            description="Indicates whether your subscription is active"
            control={
              <Badge className={
                subscription.status === "active" ?
                  "border-transparent bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300" :
                subscription.status === "payment_failed" ?
                  "border-transparent bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300" :
                  "border-transparent bg-gray-200 text-gray-800 dark:bg-gray-600/50 dark:text-gray-300"
              }>
                {subscription.status.replace(/_/g, ' ').charAt(0).toUpperCase() + subscription.status.replace(/_/g, ' ').slice(1)}
              </Badge>
            }
          />
          <SettingRow
            label="Next Renewal"
            description="Your next billing date"
            control={
              subscription.current_period_end ? (
                <span className="text-sm">{format(new Date(subscription.current_period_end), "PPP")}</span>
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
