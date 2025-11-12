"use client"

import React from "react"
import { BaseTransactionForm } from "./transaction-forms"
import { receiveFormConfig } from "./transaction-forms/form-configs"
import type { LocationContext, SkuContext, ReceiveFormValues } from "./transaction-forms/types"
import { useUserSettings } from "@/hooks/use-user-settings"

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
  const { settings } = useUserSettings()
  
  // Create a modified config with the currency injected
  const configWithCurrency = React.useMemo(() => ({
    ...receiveFormConfig,
    fields: receiveFormConfig.fields.map(field => 
      field.name === 'cost_price' 
        ? { ...field, label: `Cost Price Per Unit${settings?.currency ? ` (${settings.currency})` : ''}` }
        : field
    )
  }), [settings?.currency])

  return (
    <BaseTransactionForm<ReceiveFormValues>
      config={configWithCurrency}
      {...props}
    />
  )
}
