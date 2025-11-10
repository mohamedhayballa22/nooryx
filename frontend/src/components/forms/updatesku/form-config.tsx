import type { UpdateSkuFormConfig, UpdateSkuPayload } from "./types"
import { validationRules } from "../transaction-forms/validation-schemas"

export const updateSkuFormConfig: UpdateSkuFormConfig = {
  title: "Update SKU",
  description: "Update details for an existing SKU.",
  getTitle: (skuContext) => {
    return skuContext 
      ? `Update ${skuContext.sku_name}` 
      : "Update SKU"
  },
  getDescription: (skuContext) => {
    return skuContext
      ? `Update details for ${skuContext.sku_name}.`
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
  getDefaultValues: (skuContext) => {
    return {
      sku_code: skuContext?.sku_code || "",
      alerts: skuContext?.alerts ?? true,
      reorder_point: skuContext?.reorder_point || 0,
      low_stock_threshold: skuContext?.low_stock_threshold || 0,
    }
  },
  transformPayload: (data): UpdateSkuPayload => {
    const payload = {
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
