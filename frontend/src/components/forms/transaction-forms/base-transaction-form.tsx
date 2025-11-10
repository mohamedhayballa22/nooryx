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
import { toast } from "sonner"
import { useTxn } from "../hooks/use-txn"
import { FormField } from "./form-fields"
import type { FormConfig, FormValues, SkuContext, LocationContext } from "./types"

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
}: BaseTransactionFormProps<T>) {
  const [localOpen, setLocalOpen] = useState(false)
  const isControlled = typeof open === "boolean"
  const show = isControlled ? open! : localOpen
  const setShow = (v: boolean) => {
    if (isControlled) onOpenChange?.(v)
    else setLocalOpen(v)
  }

  // Use SKU-specific and/or location-specific default values if context is provided
  const defaultValues = (skuContext || locationContext) && config.getDefaultValues
    ? config.getDefaultValues(skuContext, locationContext)
    : config.defaultValues

  const methods = useForm<T>({
    defaultValues: defaultValues as any,
    mode: "onChange",
  })

  const { handleSubmit, reset } = methods
  const { mutate: postTxn, isPending } = useTxn({ invalidateQueries })

  const onValid = (data: T) => {
    const payload = config.transformPayload(data)

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
    return actionMap[action.toLowerCase()] || `${action.charAt(0).toUpperCase() + action.slice(1)}ing`
  }

  // Get dynamic title and description
  const title = config.getTitle ? config.getTitle(skuContext) : config.title
  const description = config.getDescription 
    ? config.getDescription(skuContext) 
    : config.description

  // Filter out SKU fields if context is provided
  const fieldsToFilter = skuContext ? Object.keys(skuContext) : []
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
  const halfWidthFields = otherFields.filter((f) => f.gridColumn === "half")

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
                  {/* Render full-width fields first */}
                  {fullWidthFields.map((fieldConfig) => (
                    <FormField key={fieldConfig.name} config={fieldConfig} />
                  ))}

                  {/* Render half-width fields in a grid */}
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

                  {/* Render alerts field before notes */}
                  {alertsField && <FormField config={alertsField} />}

                  {/* Always render notes field last if it exists */}
                  {notesField && <FormField config={notesField} />}
                </FieldGroup>
              </FieldSet>

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
                  {isPending ? `${getActionText(config.action)}...` : title.split(" ")[0]}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </div>
      </DialogContent>
    </Dialog>
  )
}
