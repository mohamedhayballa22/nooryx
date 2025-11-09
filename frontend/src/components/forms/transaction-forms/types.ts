import type { TransactionPayload } from "@/lib/api/txn"

export type TransactionAction = 
  | "receive" 
  | "ship" 
  | "adjust" 
  | "reserve" 
  | "unreserve" 
  | "transfer"

export interface BaseFormValues {
  sku_code: string
  location: string
  qty: number
  notes?: string
}

export interface ReceiveFormValues extends BaseFormValues {
  sku_name: string
  cost_price: number
  alerts: boolean
  reorder_point: number
  low_stock_threshold: number
}

export interface ShipFormValues extends BaseFormValues {
  ship_from?: "reserved" | "available" | "auto"
}

export interface AdjustFormValues extends BaseFormValues {
  reason: string
}

export interface ReserveFormValues extends BaseFormValues {
  order_id?: string
  customer?: string
}

export interface UnreserveFormValues extends BaseFormValues {
  order_id?: string
  reason?: string
}

export interface TransferFormValues extends Omit<BaseFormValues, "location"> {
  location: string // source
  target_location: string
}

export type FormValues = 
  | ReceiveFormValues 
  | ShipFormValues 
  | AdjustFormValues 
  | ReserveFormValues 
  | UnreserveFormValues 
  | TransferFormValues

export interface FieldConfig {
  name: string
  label: string
  required?: boolean
  description?: string
  type?: "text" | "number" | "textarea" | "select" | "autocomplete" | "switch"
  options?: Array<{ value: string; label: string }>
  validation?: any
  placeholder?: string
  gridColumn?: "full" | "half"
  component?: React.ComponentType<any>
  learnMoreLink?: string
  subFields?: FieldConfig[] // New property for nested fields
}

// Context for SKU-specific forms
export interface SkuContext {
  sku_code: string
  sku_name: string
}

// Context for location-specific forms
export interface LocationContext {
  location: string
}

export interface FormConfig<T extends FormValues = FormValues> {
  action: TransactionAction
  title: string
  description: string
  // Dynamic title/description based on SKU context
  getTitle?: (skuContext?: SkuContext) => string
  getDescription?: (skuContext?: SkuContext) => string
  fields: FieldConfig[]
  defaultValues: T
  // Dynamic default values based on SKU/location context
  getDefaultValues?: (skuContext?: SkuContext, locationContext?: LocationContext) => T
  transformPayload: (data: T) => TransactionPayload
  successMessage: (data: T) => { title: string; description: string }
}
