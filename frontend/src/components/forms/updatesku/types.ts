import type { FieldConfig, SkuContext } from "../transaction-forms/types"

export interface UpdateSkuFormValues {
  sku_code: string
  alerts: boolean
  reorder_point: number
  low_stock_threshold: number
}

export interface UpdateSkuPayload {
  sku_code: string
  alerts: boolean
  reorder_point?: number 
  low_stock_threshold: number
}

export interface UpdateSkuFormConfig {
  title: string
  description: string
  getTitle: (skuContext?: SkuContext) => string
  getDescription: (skuContext?: SkuContext) => string
  fields: FieldConfig[]
  defaultValues: UpdateSkuFormValues
  getDefaultValues: (skuContext?: SkuContext) => UpdateSkuFormValues
  transformPayload: (data: UpdateSkuFormValues) => UpdateSkuPayload
  successMessage: (data: UpdateSkuFormValues) => { title: string; description: string }
}
