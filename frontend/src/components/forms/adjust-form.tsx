"use client"

import React from "react"
import { BaseTransactionForm } from "./transaction-forms"
import { adjustFormConfig } from "./transaction-forms/form-configs"
import type { AdjustFormValues, LocationContext, SkuContext, BarcodeContext } from "./transaction-forms/types"

type AdjustFormProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit?: (payload: any) => void
  onSuccess?: () => void
  invalidateQueries?: string[]
  sizeClass?: string
  skuContext?: SkuContext
  locationContext?: LocationContext
  barcodeContext?: BarcodeContext
}

export function AdjustForm(props: AdjustFormProps) {
  return (
    <BaseTransactionForm<AdjustFormValues>
      config={adjustFormConfig}
      {...props}
    />
  )
}
