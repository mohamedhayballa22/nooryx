"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  email: string
  onConfirm: () => void
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  email,
  onConfirm,
}: DeleteAccountDialogProps) {
  const [inputValue, setInputValue] = useState("")
  const [isMatch, setIsMatch] = useState(false)

  useEffect(() => {
    if (open) {
      setInputValue("")
      setIsMatch(false)
    }
  }, [open])

  useEffect(() => {
    setIsMatch(inputValue.trim() === email.trim())
  }, [inputValue, email])

  const handleCancel = () => {
    setInputValue("")
    onOpenChange(false)
  }

  const handleDelete = () => {
    if (isMatch) {
      onConfirm()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete Account</DialogTitle>
          <DialogDescription>
            This action is <span className="font-semibold">permanent</span> and cannot be undone.
            <br />
            To confirm, please type your account email:
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Input
            placeholder={email}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isMatch}
          >
            Delete Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
