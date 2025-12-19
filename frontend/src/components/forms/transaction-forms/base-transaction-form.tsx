"use client"

import React, { useState } from "react"
import { useForm, FormProvider } from "react-hook-form"
import {
  FieldGroup,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import { toast } from "sonner"
import { useTxn } from "../hooks/use-txn"
import { FormField } from "./form-fields"
import type {
  FormConfig,
  FormValues,
  SkuContext,
  LocationContext,
  BarcodeContext,
} from "./types"
import { AlertCircleIcon } from "lucide-react"

interface BaseTransactionFormProps<T extends FormValues> {
  config: FormConfig<T>
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

// Map error messages to contextual titles
function getErrorTitle(errorMessage: string, action: string): string {
  const lowerMessage = errorMessage.toLowerCase()
  
  // Stock-related errors
  if (lowerMessage.includes("not enough") || lowerMessage.includes("cannot ship") || lowerMessage.includes("cannot reserve")) {
    if (action === "ship") return "Insufficient Stock to Ship"
    if (action === "reserve") return "Insufficient Stock to Reserve"
    if (action === "unreserve") return "Insufficient Reserved Stock"
    if (action === "transfer") return "Insufficient Stock to Transfer"
    if (action === "adjust") return "Invalid Adjustment"
    return "Insufficient Stock"
  }
  
  // No units available
  if (lowerMessage.includes("no units")) {
    if (action === "reserve") return "No Stock to Reserve"
    if (action === "unreserve") return "No Reserved Stock"
    return "No Stock Available"
  }
  
  // Not found errors
  if (lowerMessage.includes("doesn't exist") || lowerMessage.includes("not found")) {
    if (lowerMessage.includes("sku") || lowerMessage.includes("item")) {
      return "SKU Not Found"
    }
    if (lowerMessage.includes("location")) {
      return "Location Not Found"
    }
    return "Resource Not Found"
  }
  
  // No inventory errors
  if (lowerMessage.includes("no inventory") || lowerMessage.includes("no reservation")) {
    return "No Inventory at Location"
  }
  
  // Negative inventory
  if (lowerMessage.includes("negative inventory")) {
    return "Invalid Adjustment"
  }

  if (lowerMessage.includes("cannot be the same")) {
    return "Invalid Transfer Locations"
  }
  
  // Below reserved quantity
  if (lowerMessage.includes("below reserved")) {
    return "Cannot Reduce Below Reserved"
  }
  
  // Validation errors
  if (lowerMessage.includes("reason") || lowerMessage.includes("provide")) {
    return "Missing Required Information"
  }
  
  if (lowerMessage.includes("barcode") && lowerMessage.includes("assigned")) {
    return "Barcode Already In Use"
  }
  
  // Concurrent modification
  if (lowerMessage.includes("just updated") || lowerMessage.includes("concurrent")) {
    return "Inventory Recently Changed"
  }
  
  // Currency/config errors
  if (lowerMessage.includes("currency") || lowerMessage.includes("configuration")) {
    return "System Configuration Error"
  }
  
  // Rate limiting
  if (lowerMessage.includes("too many")) {
    return "Rate Limit Exceeded"
  }
  
  // Server errors
  if (lowerMessage.includes("something went wrong") || lowerMessage.includes("server")) {
    return "Server Error"
  }
  
  // Connection errors
  if (lowerMessage.includes("connection") || lowerMessage.includes("reach the server")) {
    return "Connection Failed"
  }
  
  // Network/unexpected errors
  if (lowerMessage.includes("unexpected error")) {
    return "Unexpected Error"
  }
  
  // Only fallback to generic if we truly don't recognize the error
  return "Request Failed"
}

export function BaseTransactionForm<T extends FormValues>({
  config,
  open,
  onOpenChange,
  onSubmit,
  onSuccess,
  invalidateQueries,
  sizeClass = "max-w-lg",
  skuContext,
  locationContext,
  barcodeContext,
}: BaseTransactionFormProps<T>) {
  const [localOpen, setLocalOpen] = useState(false)
  const isControlled = typeof open === "boolean"
  const show = isControlled ? open! : localOpen
  const setShow = (v: boolean) => {
    if (isControlled) onOpenChange?.(v)
    else setLocalOpen(v)
  }

  // Use SKU-specific and/or location-specific default values if context is provided
  const defaultValues =
    (skuContext || locationContext || barcodeContext) &&
    config.getDefaultValues
      ? config.getDefaultValues(skuContext, locationContext, barcodeContext)
      : config.defaultValues

  const methods = useForm<T>({
    defaultValues: defaultValues as any,
    mode: "onChange",
  })

  const { handleSubmit, reset } = methods
  const { mutate: postTxn, isPending, error } = useTxn({ invalidateQueries })

  const onValid = (data: T) => {
    const payload = config.transformPayload(data)
    if (barcodeContext) {
      payload.barcode = {
        value: barcodeContext.barcode_value,
        format: barcodeContext.barcode_format,
      }
    }

    postTxn(payload, {
      onSuccess: () => {
        onSubmit?.(payload)
        onSuccess?.()
        reset()
        setShow(false)

        const message = config.successMessage(data)
        toast.success(message.title, {
          description: message.description,
        })
      },
    })
  }

  const getActionText = (action: string) => {
    const actionMap: Record<string, string> = {
      receive: "Receiving",
      ship: "Shipping",
      reserve: "Reserving",
      unreserve: "Unreserving",
      adjust: "Adjusting",
      transfer: "Transferring",
    }
    return (
      actionMap[action.toLowerCase()] ||
      `${action.charAt(0).toUpperCase() + action.slice(1)}ing`
    )
  }

  // Get dynamic title and description
  const title = config.getTitle ? config.getTitle(skuContext) : config.title
  const description = config.getDescription
    ? config.getDescription(skuContext)
    : config.description

  // Filter out SKU / barcode fields if context is provided
  const fieldsToFilter = [
    ...(skuContext ? Object.keys(skuContext) : []),
    ...(barcodeContext ? Object.keys(barcodeContext) : []),
  ]

  const fieldsToShow = config.fields.filter(
    (f) => !fieldsToFilter.includes(f.name)
  )

  // Separate notes and alerts fields from other fields
  const notesField = fieldsToShow.find((f) => f.name === "notes")
  const alertsField = fieldsToShow.find((f) => f.name === "alerts")
  const otherFields = fieldsToShow.filter(
    (f) => f.name !== "notes" && f.name !== "alerts"
  )

  // Group non-notes fields by grid column for layout
  const fullWidthFields = otherFields.filter(
    (f) => f.gridColumn === "full" || !f.gridColumn
  )
  const halfWidthFields = otherFields.filter(
    (f) => f.gridColumn === "half"
  )

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className={`${sizeClass} flex max-h-[90vh] flex-col p-0`}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>
            <FieldLegend>{title}</FieldLegend>
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="scrollable-form flex-1 overflow-y-auto px-6">
          <FormProvider {...methods}>
            <form
              onSubmit={handleSubmit(onValid)}
              className="mt-5 space-y-6 pb-6"
              noValidate
            >
              <FieldSet>
                <FieldGroup>
                  {fullWidthFields.map((fieldConfig) => (
                    <FormField key={fieldConfig.name} config={fieldConfig} />
                  ))}

                  {halfWidthFields.length > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                      {halfWidthFields.map((fieldConfig) => (
                        <FormField
                          key={fieldConfig.name}
                          config={fieldConfig}
                        />
                      ))}
                    </div>
                  )}

                  {alertsField && <FormField config={alertsField} />}
                  {notesField && <FormField config={notesField} />}
                </FieldGroup>
              </FieldSet>

              {error && (
                <Alert
                  variant={
                    error.type === "error" ? "destructive" : "default"
                  }
                >
                <AlertCircleIcon />
                  <AlertTitle>
                    {error.type === "warning"
                      ? "Warning"
                      : getErrorTitle(error.message, config.action)}
                  </AlertTitle>
                  <AlertDescription>
                    {error.message}
                  </AlertDescription>
                </Alert>
              )}

              <DialogFooter className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setShow(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending
                    ? `${getActionText(config.action)}...`
                    : title.split(" ")[0]}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </div>
      </DialogContent>
    </Dialog>
  )
}
