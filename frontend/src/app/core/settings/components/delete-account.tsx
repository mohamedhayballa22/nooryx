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
  isPending?: boolean
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  email,
  onConfirm,
  isPending = false,
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
    if (isPending) return
    setInputValue("")
    onOpenChange(false)
  }

  const handleDelete = () => {
    if (isMatch && !isPending) {
      onConfirm()
    }
  }

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
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
            disabled={isPending}
          />
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isMatch || isPending}
          >
            {isPending ? "Deleting..." : "Delete Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
