import type { FormValues } from "../transaction-forms/types"

export interface UpdateSkuFormValues extends FormValues {
  sku_code: string
  alerts: boolean
  reorder_point: number
  low_stock_threshold: number
}
