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

  const configWithDefaults = React.useMemo(() => {
    const newDefaultValues = { ...receiveFormConfig.defaultValues }

    if (!props.skuContext) {
      newDefaultValues.alerts =
        settings?.alerts ?? newDefaultValues.alerts
      newDefaultValues.low_stock_threshold =
        settings?.default_low_stock_threshold ??
        newDefaultValues.low_stock_threshold
      newDefaultValues.reorder_point =
        settings?.default_reorder_point ?? newDefaultValues.reorder_point
    }

    const fields = receiveFormConfig.fields.map((field) =>
      field.name === "cost_price"
        ? {
            ...field,
            label: `Cost Price Per Unit${
              settings?.currency ? ` (${settings.currency})` : ""
            }`,
          }
        : field
    )

    return {
      ...receiveFormConfig,
      fields,
      defaultValues: newDefaultValues,
    }
  }, [settings, props.skuContext])

  return (
    <BaseTransactionForm<ReceiveFormValues>
      config={configWithDefaults}
      {...props}
    />
  )
}
