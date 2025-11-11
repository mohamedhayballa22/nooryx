"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import { useForm, FormProvider, Controller } from "react-hook-form"
import { updateSkuFormConfig } from "./form-config"
import type { UpdateSkuFormValues } from "./types"
import type { SkuContext } from "../transaction-forms/types"
import { Option, SearchableAutocomplete } from "../searchable-autocomplete"
import { Button } from "../../ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../ui/dialog"
import { Field, FieldContent, FieldDescription, FieldLabel, FieldLegend, FieldGroup, FieldSet } from "../../ui/field"
import { toast } from "sonner"
import { FormField } from "../transaction-forms/form-fields"
import { useSkuSearch } from "../hooks/use-sku-search"
import { useTxn } from "../hooks/use-txn"

type UpdateSkuFormProps = {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSuccess?: () => void
  invalidateQueries?: string[]
  sizeClass?: string
  skuContext?: SkuContext
}

export function UpdateSkuForm(props: UpdateSkuFormProps) {
  const { 
    open, 
    onOpenChange, 
    invalidateQueries, 
    sizeClass = "max-w-lg", 
    skuContext: initialSkuContext,
    onSuccess 
  } = props

  const [localOpen, setLocalOpen] = useState(false)
  const isControlled = typeof open === "boolean"
  const show = isControlled ? open : localOpen
  const setShow = (v: boolean) => {
    if (isControlled) {
      onOpenChange?.(v)
    } else {
      setLocalOpen(v)
    }
  }

  const [currentSkuContext, setCurrentSkuContext] = useState<SkuContext | undefined>(initialSkuContext)
  const [originalSkuContext, setOriginalSkuContext] = useState<SkuContext | undefined>(initialSkuContext)
  const [searchQuery, setSearchQuery] = useState("")
  
  // Store the original threshold values to restore when alerts is toggled back on
  const preservedValuesRef = useRef<{
    reorder_point: number
    low_stock_threshold: number
  } | null>(null)

  const methods = useForm<UpdateSkuFormValues>({
    defaultValues: updateSkuFormConfig.getDefaultValues(initialSkuContext),
    mode: "onChange",
  })

  const { watch, setValue, handleSubmit, formState: { errors }, reset } = methods
  const watchedSkuCode = watch("sku_code")
  const watchedAlerts = watch("alerts")
  const watchedReorderPoint = watch("reorder_point")
  const watchedLowStockThreshold = watch("low_stock_threshold")

  const { data: skuOptions = [], isLoading: isLoadingSkus } = useSkuSearch(searchQuery)
  const { mutate: postTxn, isPending } = useTxn({ invalidateQueries })

  // Initialize form with initial SKU context - run whenever initialSkuContext or show changes
  useEffect(() => {
    if (show && initialSkuContext) {
      const defaultValues = updateSkuFormConfig.getDefaultValues(initialSkuContext)
      reset(defaultValues)
      setCurrentSkuContext(initialSkuContext)
      setOriginalSkuContext(initialSkuContext)
      preservedValuesRef.current = {
        reorder_point: initialSkuContext.reorder_point ?? 0,
        low_stock_threshold: initialSkuContext.low_stock_threshold ?? 0,
      }
    }
  }, [initialSkuContext, reset, show])

  // Watch for alerts toggle and restore preserved values when turned back on
  useEffect(() => {
    if (watchedAlerts && preservedValuesRef.current) {
      // Only restore if the current values are different from preserved
      // This prevents unnecessary updates on initial render
      const currentReorderPoint = methods.getValues("reorder_point")
      const currentLowStock = methods.getValues("low_stock_threshold")
      
      if (currentReorderPoint !== preservedValuesRef.current.reorder_point) {
        setValue("reorder_point", preservedValuesRef.current.reorder_point, { shouldValidate: true })
      }
      if (currentLowStock !== preservedValuesRef.current.low_stock_threshold) {
        setValue("low_stock_threshold", preservedValuesRef.current.low_stock_threshold, { shouldValidate: true })
      }
    }
  }, [watchedAlerts, setValue, methods])

  const handleSkuChange = (val: string, option?: Option) => {
    const formattedVal = val.trim().toUpperCase()
    setValue("sku_code", formattedVal, { shouldValidate: true })

    if (option?.metadata) {
      const newSkuContext: SkuContext = {
        sku_code: option.value,
        sku_name: option.label,
        alerts: option.metadata.alerts ?? true,
        reorder_point: option.metadata.reorder_point ?? 0,
        low_stock_threshold: option.metadata.low_stock_threshold ?? 0,
      }
      
      setValue("alerts", newSkuContext.alerts ?? true)
      setValue("reorder_point", newSkuContext.reorder_point ?? 0)
      setValue("low_stock_threshold", newSkuContext.low_stock_threshold ?? 0)
      setCurrentSkuContext(newSkuContext)
      setOriginalSkuContext(newSkuContext)
      
      // Preserve the values from the newly selected SKU
      preservedValuesRef.current = {
        reorder_point: newSkuContext.reorder_point ?? 0,
        low_stock_threshold: newSkuContext.low_stock_threshold ?? 0,
      }
    } else {
      setValue("alerts", true)
      setValue("reorder_point", 0)
      setValue("low_stock_threshold", 0)
      setCurrentSkuContext(undefined)
      setOriginalSkuContext(undefined)
      preservedValuesRef.current = null
    }
  }

  const isSkuValid = useMemo(() => {
    if (initialSkuContext) return true
    return Boolean(currentSkuContext && currentSkuContext.sku_code === watchedSkuCode)
  }, [initialSkuContext, currentSkuContext, watchedSkuCode])

  const hasDataChanged = useMemo(() => {
    if (!originalSkuContext) return false
    
    // Always check if alerts changed
    if (watchedAlerts !== originalSkuContext.alerts) {
      return true
    }
    
    // Only check threshold values if alerts is currently enabled
    if (watchedAlerts) {
      return (
        watchedReorderPoint !== originalSkuContext.reorder_point ||
        watchedLowStockThreshold !== originalSkuContext.low_stock_threshold
      )
    }
    
    // If alerts is disabled and wasn't changed, no data has changed
    return false
  }, [originalSkuContext, watchedAlerts, watchedReorderPoint, watchedLowStockThreshold])

  const isUpdateEnabled = isSkuValid && hasDataChanged && Object.keys(errors).length === 0

  const onValid = (data: UpdateSkuFormValues) => {
    if (!currentSkuContext) {
      toast.error("Error", { description: "Please select a valid SKU." })
      return
    }

    const payload = updateSkuFormConfig.transformPayload(data)
    const successMsg = updateSkuFormConfig.successMessage(data)

    // Ensure the sku_code from currentSkuContext is used in the payload
    payload.sku_code = currentSkuContext.sku_code

    // TODO: Handle posting the update
  }

  const title = updateSkuFormConfig.getTitle(currentSkuContext)
  const description = updateSkuFormConfig.getDescription(currentSkuContext)

  const fieldsToRender = useMemo(() => {
    return updateSkuFormConfig.fields.filter(field => field.name !== "sku_code")
  }, [])

  const fullWidthFields = fieldsToRender.filter(
    (f) => f.gridColumn === "full" || !f.gridColumn
  )
  const halfWidthFields = fieldsToRender.filter((f) => f.gridColumn === "half")

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
              {!initialSkuContext && (
                <Field>
                  <FieldLabel>SKU Code *</FieldLabel>
                  {errors.sku_code && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.sku_code.message}
                    </p>
                  )}
                  <FieldContent>
                    <Controller
                      name="sku_code"
                      control={methods.control}
                      rules={updateSkuFormConfig.fields.find(f => f.name === "sku_code")?.validation}
                      render={({ field }) => (
                        <SearchableAutocomplete
                          options={skuOptions}
                          value={field.value}
                          onChange={handleSkuChange}
                          onSearchChange={setSearchQuery}
                          isLoading={isLoadingSkus}
                          placeholder="Type to search SKU..."
                          transformInput={(val) => val.toUpperCase()}
                          allowCreate={false}
                        />
                      )}
                    />
                  </FieldContent>
                  <FieldDescription>Search for an existing SKU to update.</FieldDescription>
                </Field>
              )}

              {isSkuValid && (
                <FieldSet>
                  <FieldGroup>
                    {fullWidthFields.map((fieldConfig) => (
                      <FormField key={fieldConfig.name} config={fieldConfig} />
                    ))}

                    {halfWidthFields.length > 0 && (
                      <div className="grid grid-cols-2 gap-4">
                        {halfWidthFields.map((fieldConfig) => (
                          <FormField key={fieldConfig.name} config={fieldConfig} />
                        ))}
                      </div>
                    )}
                  </FieldGroup>
                </FieldSet>
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
                <Button type="submit" disabled={isPending || !isUpdateEnabled}>
                  {isPending ? "Updating..." : "Update"}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </div>
      </DialogContent>
    </Dialog>
  )
}
