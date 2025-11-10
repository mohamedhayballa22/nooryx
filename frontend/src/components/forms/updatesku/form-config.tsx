import type { FormConfig, SkuContext, LocationContext } from "../transaction-forms/types"
import { validationRules } from "../transaction-forms/validation-schemas"
import type { UpdateSkuFormValues } from "./types"

export const updateSkuFormConfig: FormConfig<UpdateSkuFormValues> = {
  action: "update_sku",
  title: "Update SKU",
  description: "Update details for an existing SKU.",
  getTitle: (skuContext) => {
    return skuContext 
      ? `Update ${skuContext.sku_name}` 
      : "Update SKU"
  },
  getDescription: (skuContext) => {
    return skuContext
      ? `Update details for ${skuContext.sku_name} (${skuContext.sku_code}).`
      : "Update details for an existing SKU."
  },
  fields: [
    {
      name: "sku_code",
      label: "SKU Code",
      required: true,
      type: "autocomplete",
      validation: validationRules.skuCode,
      description: "Search for an existing SKU to update.",
      gridColumn: "full",
    },
    {
      name: "alerts",
      label: "Alerts",
      type: "switch",
      description: "System sends alerts when SKU falls below configured quantity threshold.",
      gridColumn: "full",
      subFields: [
        {
          name: "reorder_point",
          label: "Reorder Point (ROP)",
          required: true,
          type: "number",
          validation: validationRules.reorderPoint,
          description: "Minimum quantity before a restock alert is triggered.",
          placeholder: "0",
          gridColumn: "half",
        },
        {
          name: "low_stock_threshold",
          label: "Low Stock Threshold",
          required: true,
          type: "number",
          validation: validationRules.lowStockThreshold,
          description: "Below this quantity, this SKU will be marked as low in stock.",
          placeholder: "0",
          gridColumn: "half",
        },
      ],
    },
  ],
  defaultValues: {
    sku_code: "",
    alerts: true,
    reorder_point: 0,
    low_stock_threshold: 0,
  },
  getDefaultValues: (skuContext, locationContext) => {
    return {
      sku_code: skuContext?.sku_code || "",
      alerts: skuContext?.alerts ?? true,
      reorder_point: skuContext?.reorder_point || 0,
      low_stock_threshold: skuContext?.low_stock_threshold || 0,
    }
  },
  transformPayload: (data) => {
    const payload: any = {
      sku_code: data.sku_code.trim().toUpperCase(),
      alerts: data.alerts,
      reorder_point: data.reorder_point,
      low_stock_threshold: data.low_stock_threshold,
    }
    return payload
  },
  successMessage: (data) => ({
    title: "SKU updated successfully",
    description: `${data.sku_code} details have been updated.`,
  }),
}
