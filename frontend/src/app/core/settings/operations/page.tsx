"use client"

import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  Settings,
  SettingsSection,
  SettingsSubSection,
  SettingRow,
} from "@/components/app-settings"

export default function OperationsSettingsPage() {
  const [lowStockThreshold, setLowStockThreshold] = useState("10")
  const [reorderPoint, setReorderPoint] = useState("15")
  const [reservationTimeout, setReservationTimeout] = useState("never")
  const [negativeStockPolicy, setNegativeStockPolicy] = useState("block")

  return (
    <Settings>
      <SettingsSection>
        <SettingsSubSection title="Stock management">
          <SettingRow
            label="Low stock threshold"
            description="Below this quantity, an item will be marked as low in stock"
            control={
              <Input
                type="number"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-auto max-w-[80px]"
              />
            }
          />
          <SettingRow
            label="Reorder Point (ROP)"
            description="The minimum quantity before a restock alert is triggered for an item"
            control={
                <Input
                  type="number"
                  min="0"
                  value={reorderPoint}
                  onChange={(e) => setReorderPoint(e.target.value)}
                  className="w-auto max-w-[80px]"
                />
            }
          />
        </SettingsSubSection>

        <SettingsSubSection title="Operational behavior">
          <SettingRow
            label="Reservation timeout"
            description="Duration before reserved stock expires"
            control={
              <Select
                value={reservationTimeout}
                onValueChange={setReservationTimeout}
                disabled
              >
                <SelectTrigger className="w-auto min-w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="never">Never timeout</SelectItem>
                  <SelectItem value="1h">After 1 hour</SelectItem>
                  <SelectItem value="6h">After 6 hours</SelectItem>
                  <SelectItem value="24h">After 24 hours</SelectItem>
                  <SelectItem value="3d">After 3 days</SelectItem>
                  <SelectItem value="7d">After 7 days</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <SettingRow
            label="Negative stock policy"
            description="Controls whether stock can go below zero"
            control={
              <Select
                value={negativeStockPolicy}
                onValueChange={setNegativeStockPolicy}
                disabled
              >
                <SelectTrigger className="w-auto min-w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow">Allow</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="block">Block</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        </SettingsSubSection>
      </SettingsSection>
    </Settings>
  )
}
