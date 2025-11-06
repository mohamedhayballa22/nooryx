"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"
import { useState } from "react"
import { toast } from "sonner"

interface SignOutConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SignOutConfirmDialog({
  open,
  onOpenChange,
}: SignOutConfirmDialogProps) {
  const { logout } = useAuth()
  const [isPending, setIsPending] = useState(false)

  const handleConfirm = async () => {
    setIsPending(true)
    try {
      await logout()
    } catch (error) {
      toast.error("Failed to sign out")
    } finally {
      setIsPending(false)
    }
  }

  const handleCancel = () => {
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent
        className="sm:max-w-[425px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
    >
        <DialogHeader>
        <DialogTitle>Sign out</DialogTitle>
        <DialogDescription>
            Are you sure you want to sign out of your account?
        </DialogDescription>
        </DialogHeader>

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
            onClick={handleConfirm}
            disabled={isPending}
        >
            Sign out
        </Button>
        </DialogFooter>
    </DialogContent>
    </Dialog>
  )
}
