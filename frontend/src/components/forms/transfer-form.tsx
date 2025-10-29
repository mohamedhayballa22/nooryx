"use client"

import React from "react"
import { BaseTransactionForm } from "./transaction-forms"
import { transferFormConfig } from "./transaction-forms/form-configs"
import type { TransferFormValues } from "./transaction-forms/types"

type TransferFormProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit?: (payload: any) => void
  onSuccess?: () => void
  invalidateQueries?: string[]
  sizeClass?: string
}

export function TransferForm(props: TransferFormProps) {
  return (
    <BaseTransactionForm<TransferFormValues>
      config={transferFormConfig}
      {...props}
    />
  )
}
