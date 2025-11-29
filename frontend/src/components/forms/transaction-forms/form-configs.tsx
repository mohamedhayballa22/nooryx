import type {
  FormConfig,
  ReceiveFormValues,
  ShipFormValues,
  AdjustFormValues,
  ReserveFormValues,
  UnreserveFormValues,
  TransferFormValues,
} from "./types"
import { validationRules } from "./validation-schemas"

export const receiveFormConfig: FormConfig<ReceiveFormValues> = {
  action: "receive",
  title: "Receive Stock",
  description: "Record new inventory being received into a location.",
  getTitle: (skuContext) => {
    return skuContext 
      ? `Receive ${skuContext.sku_name}` 
      : "Receive Stock"
  },
  getDescription: (skuContext) => {
    return skuContext
      ? `Record new inventory of ${skuContext.sku_name} (${skuContext.sku_code}) being received.`
      : "Record new inventory being received into a location."
  },
  fields: [
    {
      name: "sku_code",
      label: "SKU Code",
      required: true,
      type: "autocomplete",
      validation: validationRules.skuCode,
      description: "Learn more about SKUs",
      learnMoreLink: "#",
      gridColumn: "full",
    },
    {
      name: "sku_name",
      label: "SKU Name",
      required: true,
      type: "text",
      validation: validationRules.skuName,
      description: "Human-friendly name tied to the SKU Code.",
      placeholder: "e.g., Office Chair Grey Fabric",
      gridColumn: "full",
    },
    {
      name: "location",
      label: "Location",
      required: true,
      type: "autocomplete",
      validation: validationRules.location,
      description: "Where the inventory is being received.",
      gridColumn: "full",
    },
    {
      name: "qty",
      label: "Quantity",
      required: true,
      type: "number",
      validation: validationRules.qty(1),
      description: "Number of units received.",
      placeholder: "0",
      gridColumn: "half",
    },
    {
      name: "cost_price",
      label: "Cost Price Per Unit", // Will be overridden by component to include user's currency
      required: true,
      type: "number",
      validation: validationRules.costPrice,
      description: "What's this?",
      learnMoreLink: "#",
      placeholder: "0.00",
      gridColumn: "half",
    },
    {
      name: "alerts",
      label: "Alerts",
      type: "switch",
      description: "System sends alerts when SKU falls below configured reorder point.",
      gridColumn: "full",
      subFields: [ // Nested fields for alerts
        {
          name: "reorder_point",
          label: "Reorder Point",
          required: true, // Required will be handled conditionally in AlertsSectionField
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
    {
      name: "notes",
      label: "Notes",
      type: "textarea",
      validation: validationRules.notes,
      gridColumn: "full",
    },
  ],
  defaultValues: {
    sku_code: "",
    sku_name: "",
    location: "",
    qty: 0,
    cost_price: 0,
    alerts: true,
    reorder_point: 0,
    low_stock_threshold: 0,
    notes: "",
  },
  getDefaultValues: (skuContext, locationContext) => {
    return {
      sku_code: skuContext?.sku_code || "",
      sku_name: skuContext?.sku_name || "",
      location: locationContext?.location || "",
      qty: 0,
      cost_price: 0,
      alerts: skuContext?.alerts ?? true,
      reorder_point: skuContext?.reorder_point || 0,
      low_stock_threshold: skuContext?.low_stock_threshold || 0,
      notes: "",
    }
  },
  transformPayload: (data) => {
    const { notes, ...rest } = data
    const payload: any = {
      ...rest,
      sku_code: rest.sku_code.trim().toUpperCase(),
      location: rest.location.trim().toUpperCase(),
      action: "receive",
    }

    if (!payload.alerts) {
      delete payload.reorder_point
    }

    if (notes && notes.trim() !== "") {
      payload.txn_metadata = { notes: notes.trim() }
    }

    return payload
  },
  successMessage: (data) => ({
    title: "Stock received successfully",
    description: `${data.qty} units of ${data.sku_name} added to ${data.location}.`,
  }),
}

export const shipFormConfig: FormConfig<ShipFormValues> = {
  action: "ship",
  title: "Ship Stock",
  description: "Record inventory being shipped out from a location.",
  getTitle: (skuContext) => {
    return skuContext 
      ? `Ship ${skuContext.sku_name}` 
      : "Ship Stock"
  },
  getDescription: (skuContext) => {
    return skuContext
      ? `Record ${skuContext.sku_name} (${skuContext.sku_code}) being shipped out.`
      : "Record inventory being shipped out from a location."
  },
  fields: [
    {
      name: "sku_code",
      label: "SKU Code",
      required: true,
      type: "autocomplete",
      validation: validationRules.skuCode,
      gridColumn: "full",
    },
    {
      name: "location",
      label: "Location",
      required: true,
      type: "autocomplete",
      validation: validationRules.location,
      description: "Where the inventory is being shipped from.",
      gridColumn: "full",
    },
    {
      name: "qty",
      label: "Quantity",
      required: true,
      type: "number",
      validation: validationRules.qty(1),
      description: "Number of units to ship.",
      placeholder: "0",
      gridColumn: "half",
    },
    {
      name: "ship_from",
      label: "Ship From",
      type: "select",
      options: [
        { value: "auto", label: "Auto" },
        { value: "reserved", label: "Reserved" },
        { value: "available", label: "Available" },
      ],
      description: "Inventory bucket to ship from.",
      placeholder: "Select ship from...",
      gridColumn: "half",
    },
    {
      name: "notes",
      label: "Notes",
      type: "textarea",
      validation: validationRules.notes,
      gridColumn: "full",
    },
  ],
  defaultValues: {
    sku_code: "",
    location: "",
    qty: 0,
    ship_from: "auto",
    notes: "",
  },
  getDefaultValues: (skuContext, locationContext) => {
    return {
      sku_code: skuContext?.sku_code || "",
      location: locationContext?.location || "",
      qty: 0,
      ship_from: "auto" as const,
      notes: "",
    }
  },
  transformPayload: (data) => {
    const { notes, ship_from, ...rest } = data
    const payload: any = {
      ...rest,
      sku_code: rest.sku_code.trim().toUpperCase(),
      location: rest.location.trim().toUpperCase(),
      action: "ship",
    }

    const metadata: any = {}
    if (ship_from) metadata.ship_from = ship_from
    if (notes && notes.trim() !== "") metadata.notes = notes.trim()

    if (Object.keys(metadata).length > 0) {
      payload.txn_metadata = metadata
    }

    return payload
  },
  successMessage: (data) => ({
    title: "Stock shipped successfully",
    description: `${data.qty} units shipped from ${data.location}.`,
  }),
}

export const adjustFormConfig: FormConfig<AdjustFormValues> = {
  action: "adjust",
  title: "Adjust Stock",
  description: "Make manual adjustments to inventory levels.",
  getTitle: (skuContext) => {
    return skuContext 
      ? `Adjust ${skuContext.sku_name}` 
      : "Adjust Stock"
  },
  getDescription: (skuContext) => {
    return skuContext
      ? `Make manual adjustments to ${skuContext.sku_name} (${skuContext.sku_code}) inventory levels.`
      : "Make manual adjustments to inventory levels."
  },
  fields: [
    {
      name: "sku_code",
      label: "SKU Code",
      required: true,
      type: "autocomplete",
      validation: validationRules.skuCode,
      gridColumn: "full",
    },
    {
      name: "location",
      label: "Location",
      required: true,
      type: "autocomplete",
      validation: validationRules.location,
      gridColumn: "full",
    },
    {
      name: "qty",
      label: "Adjustment Quantity",
      required: true,
      type: "number",
      validation: validationRules.qtyAdjust,
      description: "Positive to add, negative to subtract.",
      placeholder: "0",
      gridColumn: "half",
    },
    {
      name: "cost_price",
      label: "Cost Per Unit", // Will be overridden by component to include user's currency
      type: "number",
      validation: validationRules.costPerUnit,
      description: "What if i leave this empty?",
      learnMoreLink: "#",
      placeholder: "0.00",
      gridColumn: "half",
    },
    {
      name: "reason",
      label: "Reason",
      required: true,
      type: "textarea",
      validation: validationRules.reason,
      description: "Explain why this adjustment is being made.",
      placeholder: "e.g., Damaged goods, count discrepancy, etc.",
      gridColumn: "full",
    },
    {
      name: "notes",
      label: "Additional Notes",
      type: "textarea",
      validation: validationRules.notes,
      gridColumn: "full",
    },
  ],
  defaultValues: {
    sku_code: "",
    location: "",
    qty: 0,
    reason: "",
    notes: "",
  },
  getDefaultValues: (skuContext, locationContext) => {
    return {
      sku_code: skuContext?.sku_code || "",
      location: locationContext?.location || "",
      qty: 0,
      reason: "",
      notes: "",
    }
  },
  transformPayload: (data) => {
    const { notes, reason, cost_price, ...rest } = data
    const payload: any = {
      ...rest,
      sku_code: rest.sku_code.trim().toUpperCase(),
      location: rest.location.trim().toUpperCase(),
      action: "adjust",
      txn_metadata: { reason: reason.trim() },
    }

    if (notes && notes.trim() !== "") {
      payload.txn_metadata.notes = notes.trim()
    }

    if (cost_price != null) {
      payload.cost_price = cost_price
    }

    return payload
  },
  successMessage: (data) => ({
    title: "Stock adjusted successfully",
    description: `Adjusted ${data.qty > 0 ? "+" : ""}${data.qty} units at ${data.location}.`,
  }),
}

export const reserveFormConfig: FormConfig<ReserveFormValues> = {
  action: "reserve",
  title: "Reserve Stock",
  description: "Reserve inventory for a specific order or customer.",
  getTitle: (skuContext) => {
    return skuContext 
      ? `Reserve ${skuContext.sku_name}` 
      : "Reserve Stock"
  },
  getDescription: (skuContext) => {
    return skuContext
      ? `Reserve ${skuContext.sku_name} (${skuContext.sku_code}) for a specific order or customer.`
      : "Reserve inventory for a specific order or customer."
  },
  fields: [
    {
      name: "sku_code",
      label: "SKU Code",
      required: true,
      type: "autocomplete",
      validation: validationRules.skuCode,
      gridColumn: "full",
    },
    {
      name: "location",
      label: "Location",
      required: true,
      type: "autocomplete",
      validation: validationRules.location,
      gridColumn: "full",
    },
    {
      name: "qty",
      label: "Quantity",
      required: true,
      type: "number",
      validation: validationRules.qty(1),
      description: "Number of units to reserve.",
      placeholder: "0",
      gridColumn: "full",
    },
    {
      name: "order_id",
      label: "Order ID",
      type: "text",
      validation: validationRules.orderId,
      placeholder: "e.g., ORD-12345",
      gridColumn: "half",
    },
    {
      name: "customer",
      label: "Customer",
      type: "text",
      validation: validationRules.customer,
      placeholder: "e.g., Acme Corp",
      gridColumn: "half",
    },
    {
      name: "notes",
      label: "Notes",
      type: "textarea",
      validation: validationRules.notes,
      gridColumn: "full",
    },
  ],
  defaultValues: {
    sku_code: "",
    location: "",
    qty: 0,
    order_id: "",
    customer: "",
    notes: "",
  },
  getDefaultValues: (skuContext, locationContext) => {
    return {
      sku_code: skuContext?.sku_code || "",
      location: locationContext?.location || "",
      qty: 0,
      order_id: "",
      customer: "",
      notes: "",
    }
  },
  transformPayload: (data) => {
    const { notes, order_id, customer, ...rest } = data
    const payload: any = {
      ...rest,
      sku_code: rest.sku_code.trim().toUpperCase(),
      location: rest.location.trim().toUpperCase(),
      action: "reserve",
    }

    const metadata: any = {}
    if (order_id && order_id.trim() !== "") metadata.order_id = order_id.trim()
    if (customer && customer.trim() !== "") metadata.customer = customer.trim()
    if (notes && notes.trim() !== "") metadata.notes = notes.trim()

    if (Object.keys(metadata).length > 0) {
      payload.txn_metadata = metadata
    }

    return payload
  },
  successMessage: (data) => ({
    title: "Stock reserved successfully",
    description: `${data.qty} units reserved at ${data.location}.`,
  }),
}

export const unreserveFormConfig: FormConfig<UnreserveFormValues> = {
  action: "unreserve",
  title: "Unreserve Stock",
  description: "Release previously reserved inventory back to available stock.",
  getTitle: (skuContext) => {
    return skuContext 
      ? `Unreserve ${skuContext.sku_name}` 
      : "Unreserve Stock"
  },
  getDescription: (skuContext) => {
    return skuContext
      ? `Release previously reserved ${skuContext.sku_name} (${skuContext.sku_code}) back to available stock.`
      : "Release previously reserved inventory back to available stock."
  },
  fields: [
    {
      name: "sku_code",
      label: "SKU Code",
      required: true,
      type: "autocomplete",
      validation: validationRules.skuCode,
      gridColumn: "full",
    },
    {
      name: "location",
      label: "Location",
      required: true,
      type: "autocomplete",
      validation: validationRules.location,
      gridColumn: "full",
    },
    {
      name: "qty",
      label: "Quantity",
      required: true,
      type: "number",
      validation: validationRules.qty(1),
      description: "Number of units to unreserve.",
      placeholder: "0",
      gridColumn: "full",
    },
    {
      name: "order_id",
      label: "Order ID",
      type: "text",
      validation: validationRules.orderId,
      placeholder: "e.g., ORD-12345",
      gridColumn: "half",
    },
    {
      name: "reason",
      label: "Reason",
      required: true,
      type: "text",
      validation: validationRules.reason,
      placeholder: "e.g., Order cancelled",
      gridColumn: "half",
    },
    {
      name: "notes",
      label: "Notes",
      type: "textarea",
      validation: validationRules.notes,
      gridColumn: "full",
    },
  ],
  defaultValues: {
    sku_code: "",
    location: "",
    qty: 0,
    order_id: "",
    reason: "",
    notes: "",
  },
  getDefaultValues: (skuContext, locationContext) => {
    return {
      sku_code: skuContext?.sku_code || "",
      location: locationContext?.location || "",
      qty: 0,
      order_id: "",
      reason: "",
      notes: "",
    }
  },
  transformPayload: (data) => {
    const { notes, order_id, reason, ...rest } = data
    const payload: any = {
      ...rest,
      sku_code: rest.sku_code.trim().toUpperCase(),
      location: rest.location.trim().toUpperCase(),
      action: "unreserve",
    }

    const metadata: any = {}
    if (order_id && order_id.trim() !== "") metadata.order_id = order_id.trim()
    if (reason && reason.trim() !== "") metadata.reason = reason.trim()
    if (notes && notes.trim() !== "") metadata.notes = notes.trim()

    if (Object.keys(metadata).length > 0) {
      payload.txn_metadata = metadata
    }

    return payload
  },
  successMessage: (data) => ({
    title: "Stock unreserved successfully",
    description: `${data.qty} units unreserved at ${data.location}.`,
  }),
}

export const transferFormConfig: FormConfig<TransferFormValues> = {
  action: "transfer",
  title: "Transfer Stock",
  description: "Move inventory from one location to another.",
  getTitle: (skuContext) => {
    return skuContext 
      ? `Transfer ${skuContext.sku_name}` 
      : "Transfer Stock"
  },
  getDescription: (skuContext) => {
    return skuContext
      ? `Move ${skuContext.sku_name} (${skuContext.sku_code}) from one location to another.`
      : "Move inventory from one location to another."
  },
  fields: [
    {
      name: "sku_code",
      label: "SKU Code",
      required: true,
      type: "autocomplete",
      validation: validationRules.skuCode,
      gridColumn: "full",
    },
    {
      name: "location",
      label: "Source Location",
      required: true,
      type: "autocomplete",
      validation: validationRules.location,
      description: "Where the inventory is being transferred from.",
      gridColumn: "half",
    },
    {
      name: "target_location",
      label: "Target Location",
      required: true,
      type: "autocomplete",
      validation: validationRules.location,
      description: "Where the inventory is being transferred to.",
      gridColumn: "half",
    },
    {
      name: "qty",
      label: "Quantity",
      required: true,
      type: "number",
      validation: validationRules.qty(1),
      description: "Number of units to transfer.",
      placeholder: "0",
      gridColumn: "full",
    },
    {
      name: "notes",
      label: "Notes",
      type: "textarea",
      validation: validationRules.notes,
      gridColumn: "full",
    },
  ],
  defaultValues: {
    sku_code: "",
    location: "",
    target_location: "",
    qty: 0,
    notes: "",
  },
  getDefaultValues: (skuContext, locationContext) => {
    return {
      sku_code: skuContext?.sku_code || "",
      location: locationContext?.location || "",
      target_location: "",
      qty: 0,
      notes: "",
    }
  },
  transformPayload: (data) => {
    const { notes, ...rest } = data
    const payload: any = {
      ...rest,
      sku_code: rest.sku_code.trim().toUpperCase(),
      location: rest.location.trim().toUpperCase(),
      target_location: rest.target_location.trim().toUpperCase(),
      action: "transfer",
    }

    if (notes && notes.trim() !== "") {
      payload.txn_metadata = { notes: notes.trim() }
    }

    return payload
  },
  successMessage: (data) => ({
    title: "Stock transferred successfully",
    description: `${data.qty} units transferred from ${data.location} to ${data.target_location}.`,
  }),
}
