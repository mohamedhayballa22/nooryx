"use client"

import React from "react"
import { BaseTransactionForm } from "./transaction-forms"
import { adjustFormConfig } from "./transaction-forms/form-configs"
import type { AdjustFormValues } from "./transaction-forms/types"

type AdjustFormProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit?: (payload: any) => void
  sizeClass?: string
}

export function AdjustForm(props: AdjustFormProps) {
  return (
    <BaseTransactionForm<AdjustFormValues>
      config={adjustFormConfig}
      {...props}
    />
  )
}
