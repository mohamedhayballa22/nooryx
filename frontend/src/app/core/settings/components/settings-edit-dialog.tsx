"use client"

import { useState, useEffect, ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useUpdateUserSettings } from "@/hooks/use-user-settings"

interface SettingsEditDialogProps<T extends string | number> {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  initialValue?: T
  settingKey?: string
  onDelete?: () => void
  children?: (value: T, onChange: (value: T) => void) => ReactNode
}

export function SettingsEditDialog<T extends string | number = string>({
  open,
  onOpenChange,
  title,
  description,
  initialValue,
  settingKey,
  onDelete,
  children,
}: SettingsEditDialogProps<T>) {
  const [value, setValue] = useState<T>(initialValue ?? ("" as T))
  const [hasChanges, setHasChanges] = useState(false)

  const { mutateAsync: updateSettings, isPending } = useUpdateUserSettings()

  const isDeleteMode = !children && onDelete

  useEffect(() => {
    if (open) {
      setValue(initialValue ?? ("" as T))
      setHasChanges(false)
    }
  }, [open, initialValue])

  useEffect(() => {
    setHasChanges(value !== initialValue)
  }, [value, initialValue])

  const handleSave = async () => {
    if (!settingKey) {
      console.warn("No settingKey provided to SettingsEditDialog — nothing to update.")
      onOpenChange(false)
      return
    }

    // Close dialog immediately (optimistic)
    onOpenChange(false)

    // Show optimistic success toast
    toast.success("Changes saved successfully.")

    try {
      await updateSettings({ [settingKey]: value })
    } catch (err) {
      // Revert on error
      toast.error("Failed to save changes. Please try again.")
      setValue(initialValue ?? ("" as T))
    }
  }

  const handleDelete = () => {
    if (onDelete) onDelete()
    onOpenChange(false)
  }

  const handleCancel = () => {
    setValue(initialValue ?? ("" as T))
    setHasChanges(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {children && <div>{children(value, setValue)}</div>}

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
          {isDeleteMode ? (
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              Delete
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={!hasChanges || isPending}>
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
