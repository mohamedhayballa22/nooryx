"use client"

import React from "react"
import { BaseTransactionForm } from "./transaction-forms"
import { unreserveFormConfig } from "./transaction-forms/form-configs"
import type { LocationContext, SkuContext, UnreserveFormValues } from "./transaction-forms/types"

type UnreserveFormProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit?: (payload: any) => void
  onSuccess?: () => void
  invalidateQueries?: string[]
  sizeClass?: string
  skuContext?: SkuContext
  locationContext?: LocationContext
}

export function UnreserveForm(props: UnreserveFormProps) {
  return (
    <BaseTransactionForm<UnreserveFormValues>
      config={unreserveFormConfig}
      {...props}
    />
  )
}
