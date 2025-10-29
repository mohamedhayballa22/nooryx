import { RegisterOptions } from "react-hook-form"

export const NOTES_MAX_LENGTH = 500

export const validationRules = {
  skuCode: {
    required: "SKU Code is required",
    maxLength: { value: 50, message: "SKU Code cannot exceed 50 characters" },
    minLength: { value: 3, message: "SKU Code must be at least 3 characters" },
    pattern: {
      value: /^[A-Z0-9-]+$/,
      message: "SKU must only contain letters, numbers, and dashes (no spaces or special characters)",
    },
  } as RegisterOptions,

  skuName: {
    required: "SKU Name is required",
    maxLength: { value: 80, message: "SKU Name cannot exceed 80 characters" },
    minLength: { value: 3, message: "SKU Name must be at least 3 characters" },
    pattern: {
      value: /^[A-Za-z0-9\s-]+$/,
      message: "SKU Name can only contain letters, numbers, spaces, and dashes",
    },
  } as RegisterOptions,

  location: {
    required: "Location is required",
    maxLength: { value: 50, message: "Location cannot exceed 50 characters" },
    minLength: { value: 3, message: "Location must be at least 3 characters" },
    pattern: {
      value: /^[A-Z0-9-]+$/,
      message: "Location must only contain letters, numbers, and dashes (no spaces or special characters)",
    },
  } as RegisterOptions,

  qty: (min: number = 1) => ({
    required: "Quantity is required",
    valueAsNumber: true,
    min: { value: min, message: `Must be at least ${min}` },
  } as RegisterOptions),

  qtyAdjust: {
    required: "Quantity is required",
    valueAsNumber: true,
    validate: (value: number) => value !== 0 || "Quantity cannot be zero",
  } as RegisterOptions,

  costPrice: {
    required: "Cost price is required",
    valueAsNumber: true,
    min: { value: 0.01, message: "Must be greater than 0" },
  } as RegisterOptions,

  notes: {
    maxLength: {
      value: NOTES_MAX_LENGTH,
      message: `Notes must be ${NOTES_MAX_LENGTH} characters or less`,
    },
  } as RegisterOptions,

  reason: {
    required: "Reason is required",
    minLength: { value: 3, message: "Reason must be at least 3 characters" },
    maxLength: { value: 200, message: "Reason cannot exceed 200 characters" },
  } as RegisterOptions,

  orderId: {
    maxLength: { value: 50, message: "Order ID cannot exceed 50 characters" },
  } as RegisterOptions,

  customer: {
    maxLength: { value: 100, message: "Customer cannot exceed 100 characters" },
  } as RegisterOptions,
}
