"use client"

import { useState } from "react"
import { EditPencil } from "iconoir-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Settings,
  SettingsSection,
  SettingsSubSection,
  SettingRow,
} from "@/components/app-settings"
import { Button } from "@/components/ui/button"
import { SettingsEditDialog } from "../components/settings-edit-dialog"

export default function OperationsSettingsPage() {
  const [lowStockThreshold, setLowStockThreshold] = useState("10")
  const [reorderPoint, setReorderPoint] = useState("15")

  // Dialog states
  const [editingLowStock, setEditingLowStock] = useState(false)
  const [editingReorderPoint, setEditingReorderPoint] = useState(false)

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
                  <span className="text-sm">{lowStockThreshold}</span>
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
                  <span className="text-sm">{reorderPoint}</span>
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
        initialValue={lowStockThreshold}
        onSave={setLowStockThreshold}
      >
        {(value, onChange) => (
          <div>
            <Input
              id="low-stock"
              type="number"
              min="0"
              value={value}
              onChange={(e) => onChange(e.target.value)}
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
        initialValue={reorderPoint}
        onSave={setReorderPoint}
      >
        {(value, onChange) => (
          <div className="space-y-2">
            <Input
              id="reorder-point"
              type="number"
              min="0"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Enter quantity"
              className="mt-2"
            />
          </div>
        )}
      </SettingsEditDialog>
    </>
  )
}
