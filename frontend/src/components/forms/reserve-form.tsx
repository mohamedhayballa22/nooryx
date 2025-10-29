"use client"

import React from "react"
import { BaseTransactionForm } from "./transaction-forms"
import { reserveFormConfig } from "./transaction-forms/form-configs"
import type { ReserveFormValues } from "./transaction-forms/types"

type ReserveFormProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit?: (payload: any) => void
  onSuccess?: () => void
  invalidateQueries?: string[]
  sizeClass?: string
}

export function ReserveForm(props: ReserveFormProps) {
  return (
    <BaseTransactionForm<ReserveFormValues>
      config={reserveFormConfig}
      {...props}
    />
  )
}
