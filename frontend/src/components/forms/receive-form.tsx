"use client"

import React from "react"
import { BaseTransactionForm } from "./transaction-forms"
import { receiveFormConfig } from "./transaction-forms/form-configs"
import type { ReceiveFormValues } from "./transaction-forms/types"

type ReceiveFormProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit?: (payload: any) => void
  sizeClass?: string
}

export function ReceiveForm(props: ReceiveFormProps) {
  return (
    <BaseTransactionForm<ReceiveFormValues>
      config={receiveFormConfig}
      {...props}
    />
  )
}
