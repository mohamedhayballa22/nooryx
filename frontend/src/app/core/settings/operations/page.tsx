"use client"

import { useEffect, useState } from "react"
import { EditPencil } from "iconoir-react"
import { Input } from "@/components/ui/input"
import {
  Settings,
  SettingsSection,
  SettingsSubSection,
  SettingRow,
} from "@/components/app-settings"
import { Button } from "@/components/ui/button"
import { SettingsEditDialog } from "../components/settings-edit-dialog"
import { useUserSettings, useUpdateUserSettings } from "@/hooks/use-user-settings"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

export default function OperationsSettingsPage() {
  const { settings } = useUserSettings()
  const { mutateAsync: updateSettings } = useUpdateUserSettings()
  
  // Dialog states
  const [editingLowStock, setEditingLowStock] = useState(false)
  const [editingReorderPoint, setEditingReorderPoint] = useState(false)
  
  // Local state for optimistic UI
  const [alertsEnabled, setAlertsEnabled] = useState(settings?.alerts ?? true)

  // Sync local state when settings change
  useEffect(() => {
    if (settings?.alerts !== undefined) {
      setAlertsEnabled(settings.alerts)
    }
  }, [settings?.alerts])

  const handleAlertsToggle = async (checked: boolean) => {
    // Optimistic update - update UI immediately
    setAlertsEnabled(checked)
    
    try {
      await updateSettings({ alerts: checked })
      toast.success(checked ? "Alerts enabled" : "Alerts disabled")
    } catch (err) {
      // Rollback on error
      setAlertsEnabled(!checked)
      toast.error("Failed to update alerts setting. Please try again.")
    }
  }

  return (
    <>
      <Settings>
        <SettingsSection>
          <SettingsSubSection title="Stock management">
            <SettingRow
              label="Low stock threshold"
              description="Below this quantity, an item will be marked as low in stock"
              control={
                <div className="flex items-center gap-2">
                  <span className="text-sm">{settings?.low_stock_threshold}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => setEditingLowStock(true)}
                  >
                    <EditPencil className="h-4 w-4" />
                  </Button>
                </div>
              }
            />
            <SettingRow
              label="Reorder Point (ROP)"
              description="The minimum quantity before a restock alert is triggered for an item"
              control={
                <div className="flex items-center gap-2">
                  <span className="text-sm">{settings?.reorder_point}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => setEditingReorderPoint(true)}
                  >
                    <EditPencil className="h-4 w-4" />
                  </Button>
                </div>
              }
            />
          <SettingRow
            label="Alerts"
            description="Turn on alerts for stock levels, reorder thresholds, and system updates"
            control={
              <Switch 
                className="cursor-pointer"
                checked={alertsEnabled}
                onCheckedChange={handleAlertsToggle}
              />
            }
          />
          </SettingsSubSection>

          <SettingsSubSection title="Operational behavior">
            <SettingRow
              label="Reservation timeout"
              description="Duration before reserved stock expires"
              control={<span className="text-sm">Never timeout</span>}
            />
            <SettingRow
              label="Negative stock policy"
              description="Controls whether stock can go below zero"
              control={<span className="text-sm">Block</span>}
            />
          </SettingsSubSection>
        </SettingsSection>
      </Settings>

      {/* Edit Dialogs */}
      <SettingsEditDialog
        open={editingLowStock}
        onOpenChange={setEditingLowStock}
        title="Low stock threshold"
        description="Below this quantity, an item will be marked as low in stock"
        initialValue={settings?.low_stock_threshold}
        settingKey="low_stock_threshold"
      >
        {(value, setValue) => (
          <div>
            <Input
              id="low-stock"
              type="number"
              min="0"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              placeholder="Enter quantity"
              className="mt-2"
            />
          </div>
        )}
      </SettingsEditDialog>

      <SettingsEditDialog
        open={editingReorderPoint}
        onOpenChange={setEditingReorderPoint}
        title="Reorder Point (ROP)"
        description="The minimum quantity before a restock alert is triggered"
        initialValue={settings?.reorder_point}
        settingKey="reorder_point"
      >
        {(value, setValue) => (
          <div className="space-y-2">
            <Input
              id="reorder-point"
              type="number"
              min="0"
              value={value}
              onChange={(e) => setValue(Number(e.target.value))}
              placeholder="Enter quantity"
              className="mt-2"
            />
          </div>
        )}
      </SettingsEditDialog>
    </>
  )
}
