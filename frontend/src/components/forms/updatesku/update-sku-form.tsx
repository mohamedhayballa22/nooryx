"use client"

import React, { useState, useEffect, useMemo } from "react"
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
  const [searchQuery, setSearchQuery] = useState("")

  const methods = useForm<UpdateSkuFormValues>({
    defaultValues: updateSkuFormConfig.getDefaultValues(initialSkuContext),
    mode: "onChange",
  })

  const { watch, setValue, handleSubmit, formState: { errors }, reset } = methods
  const watchedSkuCode = watch("sku_code")

  const { data: skuOptions = [], isLoading: isLoadingSkus } = useSkuSearch(searchQuery)
  const { mutate: postTxn, isPending } = useTxn({ invalidateQueries })

  // Initialize form with initial SKU context
  useEffect(() => {
    if (initialSkuContext) {
      const defaultValues = updateSkuFormConfig.getDefaultValues(initialSkuContext)
      reset(defaultValues)
      setCurrentSkuContext(initialSkuContext)
    }
  }, [initialSkuContext, reset])

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
    } else {
      setValue("alerts", true)
      setValue("reorder_point", 0)
      setValue("low_stock_threshold", 0)
      setCurrentSkuContext(undefined)
    }
  }

  const isSkuValid = useMemo(() => {
    if (initialSkuContext) return true
    return Boolean(currentSkuContext && currentSkuContext.sku_code === watchedSkuCode)
  }, [initialSkuContext, currentSkuContext, watchedSkuCode])

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
                <Button type="submit" disabled={isPending || !isSkuValid}>
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
