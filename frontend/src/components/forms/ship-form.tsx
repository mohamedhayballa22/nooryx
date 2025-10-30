"use client"

import React from "react"
import { BaseTransactionForm } from "./transaction-forms"
import { shipFormConfig } from "./transaction-forms/form-configs"
import type { ShipFormValues, SkuContext } from "./transaction-forms/types"

type ShipFormProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit?: (payload: any) => void
  onSuccess?: () => void
  invalidateQueries?: string[]
  sizeClass?: string
  skuContext?: SkuContext
}

export function ShipForm(props: ShipFormProps) {
  return (
    <BaseTransactionForm<ShipFormValues>
      config={shipFormConfig}
      {...props}
    />
  )
}
