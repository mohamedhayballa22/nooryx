"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useForm, FormProvider, Controller } from "react-hook-form"
import { updateSkuFormConfig } from "./form-config"
import type { UpdateSkuFormValues } from "./types"
import type { SkuContext, LocationContext, FormConfig } from "../transaction-forms/types"
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
  skuContext?: SkuContext // Initial SKU context for pre-filling
}

export function UpdateSkuForm(props: UpdateSkuFormProps) {
  const { open, onOpenChange, onSuccess, invalidateQueries, sizeClass = "max-w-lg", skuContext: initialSkuContext } = props

  const [localOpen, setLocalOpen] = useState(false)
  const isControlled = typeof open === "boolean"
  const show = isControlled ? open! : localOpen
  const setShow = (v: boolean) => {
    if (isControlled) onOpenChange?.(v)
    else setLocalOpen(v)
  }

  // State to hold the SKU context that will be used for title/description and payload
  const [currentSkuContext, setCurrentSkuContext] = useState<SkuContext | undefined>(initialSkuContext)

  const methods = useForm<UpdateSkuFormValues>({
    defaultValues: updateSkuFormConfig.defaultValues,
    mode: "onChange",
  })

  const { watch, setValue, handleSubmit, reset, formState: { errors } } = methods
  const watchedSkuCode = watch("sku_code")

  // Sku search for the autocomplete
  const [searchQuery, setSearchQuery] = useState("")
  const { data: skuOptions = [], isLoading: isLoadingSkus } = useSkuSearch(searchQuery)

  // Effect to handle initial skuContext and update form values
  useEffect(() => {
    if (initialSkuContext) {
      setValue("sku_code", initialSkuContext.sku_code, { shouldValidate: true })
      setValue("alerts", initialSkuContext.alerts ?? true)
      setValue("reorder_point", initialSkuContext.reorder_point || 0)
      setValue("low_stock_threshold", initialSkuContext.low_stock_threshold || 0)
      setCurrentSkuContext(initialSkuContext) // Set the currentSkuContext
    }
  }, [initialSkuContext, setValue])

  // Handle SKU selection from autocomplete
  const handleSkuChange = (val: string, option?: Option) => {
    const formattedVal = val.trim().toUpperCase()
    setValue("sku_code", formattedVal, { shouldValidate: true })

    if (option?.metadata) {
      // If a valid option is selected, update the form fields and currentSkuContext
      setValue("alerts", option.metadata.alerts ?? true)
      setValue("reorder_point", option.metadata.reorder_point || 0)
      setValue("low_stock_threshold", option.metadata.low_stock_threshold || 0)
      setCurrentSkuContext({
        sku_code: option.value,
        sku_name: option.label,
        alerts: option.metadata.alerts,
        reorder_point: option.metadata.reorder_point,
        low_stock_threshold: option.metadata.low_stock_threshold,
      })
    } else {
      // If no valid option selected (e.g., cleared or typed invalid), reset dependent fields and currentSkuContext
      setValue("alerts", true)
      setValue("reorder_point", 0)
      setValue("low_stock_threshold", 0)
      setCurrentSkuContext(undefined)
    }
  }

  // Determine if the SKU autocomplete field is valid (i.e., a valid SKU has been selected)
  const isSkuAutocompleteValid = useMemo(() => {
    if (initialSkuContext) return true; // If initial context, SKU is considered valid
    return !!currentSkuContext && currentSkuContext.sku_code === watchedSkuCode;
  }, [initialSkuContext, currentSkuContext, watchedSkuCode]);

  // Use the useTxn hook for submission
  const { mutate: postTxn, isPending } = useTxn({ invalidateQueries })

  const onValid = (data: UpdateSkuFormValues) => {
    // Ensure currentSkuContext is available for submission
    if (!currentSkuContext) {
      toast.error("Error", { description: "Please select a valid SKU." });
      return;
    }

    const payload = updateSkuFormConfig.transformPayload(data);
    // Ensure the sku_code from currentSkuContext is used in the payload
    payload.sku_code = currentSkuContext.sku_code;

    postTxn(payload, {
      onSuccess: () => {
        onSuccess?.()
        reset()
        setShow(false)

        const message = updateSkuFormConfig.successMessage(data)
        toast.success(message.title, {
          description: message.description,
        })
      },
    })
  }

  const getActionText = (action: string) => {
    const actionMap: Record<string, string> = {
      update_sku: "Updating SKU",
    }
    return actionMap[action.toLowerCase()] || `${action.charAt(0).toUpperCase() + action.slice(1)}ing`
  }

  // Get dynamic title and description
  const title = updateSkuFormConfig.getTitle ? updateSkuFormConfig.getTitle(currentSkuContext) : updateSkuFormConfig.title
  const description = updateSkuFormConfig.getDescription
    ? updateSkuFormConfig.getDescription(currentSkuContext)
    : updateSkuFormConfig.description

  // Filter out SKU fields if initialSkuContext is provided or if we are handling it separately
  const fieldsToRender = useMemo(() => {
    let fields = updateSkuFormConfig.fields;
    // Filter out the sku_code field as it's handled separately
    fields = fields.filter(field => field.name !== "sku_code");
    return fields;
  }, [initialSkuContext]);

  // Group non-notes fields by grid column for layout
  const fullWidthFields = fieldsToRender.filter(
    (f) => f.gridColumn === "full" || !f.gridColumn
  );
  const halfWidthFields = fieldsToRender.filter((f) => f.gridColumn === "half");


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
              {/* Render SKU Code autocomplete only if no initialSkuContext */}
              {!initialSkuContext && (
                <Field>
                  <FieldLabel>SKU Code *</FieldLabel>
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
                          allowCreate={false} // Do not allow creating new SKUs
                        />
                      )}
                    />
                  </FieldContent>
                  {errors.sku_code && (
                    <p className="text-xs text-red-500 mt-1">{errors.sku_code.message as string}</p>
                  )}
                  <FieldDescription>Search for an existing SKU to update.</FieldDescription>
                </Field>
              )}

              {/* Render other fields if a valid SKU is selected/provided */}
              {(isSkuAutocompleteValid || initialSkuContext) && (
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
                <Button type="submit" disabled={isPending || !isSkuAutocompleteValid}>
                  {isPending ? getActionText(updateSkuFormConfig.action) : title.split(" ")[0]}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </div>
      </DialogContent>
    </Dialog>
  )
}
