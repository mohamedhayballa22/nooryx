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

interface SettingsEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  initialValue?: string
  onSave?: (value: string) => void
  onDelete?: () => void
  children?: (value: string, onChange: (value: string) => void) => ReactNode
}

export function SettingsEditDialog({
  open,
  onOpenChange,
  title,
  description,
  initialValue = "",
  onSave,
  onDelete,
  children,
}: SettingsEditDialogProps) {
  const [value, setValue] = useState(initialValue)
  const [hasChanges, setHasChanges] = useState(false)

  // Determine if this is a delete dialog
  const isDeleteMode = !children && onDelete

  // Reset value when dialog opens or initialValue changes
  useEffect(() => {
    if (open) {
      setValue(initialValue)
      setHasChanges(false)
    }
  }, [open, initialValue])

  // Track changes
  useEffect(() => {
    setHasChanges(value !== initialValue)
  }, [value, initialValue])

  const handleSave = () => {
    if (onSave) {
      onSave(value)
    }
    onOpenChange(false)
  }

  const handleDelete = () => {
    if (onDelete) {
      onDelete()
    }
    onOpenChange(false)
  }

  const handleCancel = () => {
    setValue(initialValue)
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
        {children && (
          <div>
            {children(value, setValue)}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          {isDeleteMode ? (
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={!hasChanges}>
              Save
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
