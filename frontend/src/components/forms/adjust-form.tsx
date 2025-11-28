"use client"

import React from "react"
import { BaseTransactionForm } from "./transaction-forms"
import { adjustFormConfig } from "./transaction-forms/form-configs"
import type {
  AdjustFormValues,
  LocationContext,
  SkuContext,
  BarcodeContext,
} from "./transaction-forms/types"
import { useUserSettings } from "@/hooks/use-user-settings"

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
  const { settings } = useUserSettings()

  const configWithDefaults = React.useMemo(() => {
    const fields = adjustFormConfig.fields.map((field) =>
      field.name === "cost_price"
        ? {
            ...field,
            label: `Cost Per Unit${
              settings?.currency ? ` (${settings.currency})` : ""
            }`,
          }
        : field
    )

    return {
      ...adjustFormConfig,
      fields,
    }
  }, [settings])

  return (
    <BaseTransactionForm<AdjustFormValues>
      config={configWithDefaults}
      {...props}
    />
  )
}
