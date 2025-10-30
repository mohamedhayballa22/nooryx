"use client"

import React from "react"
import { BaseTransactionForm } from "./transaction-forms"
import { receiveFormConfig } from "./transaction-forms/form-configs"
import type { LocationContext, ReceiveFormValues, SkuContext } from "./transaction-forms/types"

type ReceiveFormProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit?: (payload: any) => void
  onSuccess?: () => void
  invalidateQueries?: string[]
  sizeClass?: string
  skuContext?: SkuContext
  locationContext?: LocationContext
}

export function ReceiveForm(props: ReceiveFormProps) {
  return (
    <BaseTransactionForm<ReceiveFormValues>
      config={receiveFormConfig}
      {...props}
    />
  )
}
