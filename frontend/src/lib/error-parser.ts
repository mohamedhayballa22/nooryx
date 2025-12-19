export interface ApiError {
  response: {
    status: number
    data: {
      detail: string | any
      retry_after?: number
      [key: string]: any
    }
  }
}

export interface ParsedError {
  type: "error" | "warning"
  message: string
  context?: Record<string, any>
}

// Map of backend error patterns to user-friendly message templates
const errorMessageMap: Record<string, string> = {
  // Configuration / system-level (very specific, unique)
  "Invalid currency configuration":
    "Currency configuration error. Please contact support.",

  "Concurrent modification detected":
    "This inventory was just updated by someone else. Please try again.",

  // Barcode / SKU assignment
  "already assigned to another SKU":
    "This barcode is already assigned to another SKU.",

  // Explicit transfer constraints
  "Cannot transfer from location with no inventory":
    "Source location has no inventory of this SKU.",

  "Cannot transfer to the same location":
    "Source and target locations cannot be the same.",

  // Reservation / availability math (most specific stock errors)
  "Not enough available stock to reserve":
    "{available} units available. Cannot reserve {requested} units.",

  "Not enough reserved stock to unreserve":
    "{reserved} units reserved. Cannot unreserve {requested} units.",

  "Not enough available stock":
    "{available} units available. Cannot ship {requested} units.",

  "Not enough reserved stock":
    "{reserved} units reserved. Cannot ship {requested} units.",


  // Inventory invariants
  "on_hand < reserved":
    "Cannot adjust below reserved quantity.",

  "negative inventory":
    "This adjustment would result in negative inventory.",

  // Generic stock failure (must be AFTER specific stock cases)
  "Not enough stock":
    "Not enough stock available.",

  // Inventory presence (generic)
  "has no inventory":
    "SKU has no inventory at the specified location.",

  // Existence checks (broad regex, late)
  "SKU .* not found":
    "SKU '{sku_code}' doesn't exist in your inventory.",

  "Location .* not found":
    "The specified location doesn't exist.",

  // Validation / user input (very generic)
  "provide a reason":
    "Please provide a reason for this adjustment.",
};


function formatString(template: string, context: Record<string, any>): string {
  return template.replace(/{(\w+)}/g, (_, key) => {
    const value = context[key]
    return value !== undefined ? String(value) : `{${key}}`
  })
}

function findMatchingErrorTemplate(errorMessage: string): string | null {
  for (const [pattern, template] of Object.entries(errorMessageMap)) {
    if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
      return template
    }
  }
  return null
}

export function parseTransactionError(error: any): ParsedError {
  // Check if it's an ApiError instance
  if (error instanceof Error && 'status' in error && 'body' in error) {
    const apiError = error as { status: number; body: any }
    const { status, body } = apiError

    // Rate Limiting
    if (status === 429) {
      return {
        type: "warning",
        message: `Too many requests. Please wait ${body?.retry_after || 60} seconds.`,
      }
    }

    // Internal Server Error
    if (status >= 500) {
      return {
        type: "error",
        message: "Something went wrong on our end. Please try again.",
      }
    }

    // Extract error detail and all context from the body
    const errorDetail = body?.error?.detail || body?.detail
    
    // Build context from all fields in the error response
    const context: Record<string, any> = {}
    const errorData = body?.error || body || {}
    
    // Extract all relevant fields for template replacement
    Object.keys(errorData).forEach(key => {
      if (key !== 'detail' && errorData[key] !== undefined) {
        context[key] = errorData[key]
      }
    })
    
    if (!errorDetail) {
      return {
        type: "error",
        message: error.message || "An unexpected error occurred. Please try again.",
        context,
      }
    }

    // Handle both string and object detail
    const errorMessage = typeof errorDetail === "string" 
      ? errorDetail 
      : errorDetail.message || JSON.stringify(errorDetail)

    // If errorDetail is an object, merge its properties into context
    if (typeof errorDetail === "object") {
      Object.assign(context, errorDetail)
    }

    // Find matching error template
    const messageTemplate = findMatchingErrorTemplate(errorMessage)
    
    if (messageTemplate) {
      return {
        type: errorMessage.toLowerCase().includes("concurrent") ? "warning" : "error",
        message: formatString(messageTemplate, context),
        context,
      }
    }

    // Fallback: use the original error message
    return {
      type: "error",
      message: errorMessage || error.message || "An unexpected error occurred. Please try again.",
      context,
    }
  }

  // Network Error or unknown error structure (not an ApiError)
  return {
    type: "error",
    message: "Unable to reach the server. Please check your connection.",
  }
}
