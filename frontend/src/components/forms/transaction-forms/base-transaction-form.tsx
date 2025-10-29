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
import type { FormConfig, FormValues } from "./types"

interface BaseTransactionFormProps<T extends FormValues> {
  config: FormConfig<T>
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onSubmit?: (payload: any) => void
  sizeClass?: string
}

export function BaseTransactionForm<T extends FormValues>({
  config,
  open,
  onOpenChange,
  onSubmit,
  sizeClass = "max-w-lg",
}: BaseTransactionFormProps<T>) {
  const [localOpen, setLocalOpen] = useState(false)
  const isControlled = typeof open === "boolean"
  const show = isControlled ? open! : localOpen
  const setShow = (v: boolean) => {
    if (isControlled) onOpenChange?.(v)
    else setLocalOpen(v)
  }

  const methods = useForm<T>({
    defaultValues: config.defaultValues as any,
  })

  const { handleSubmit, reset } = methods
  const { mutate: postTxn, isPending } = useTxn()

  const onValid = (data: T) => {
    const payload = config.transformPayload(data)

    postTxn(payload, {
      onSuccess: () => {
        onSubmit?.(payload)
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

  // Separate notes field from others
  const notesField = config.fields.find((f) => f.name === "notes")
  // Filter out the notes field from the regular fields
  const regularFields = config.fields.filter((f) => f.name !== "notes")

  // Group non-notes fields by grid column
  const nonNotesFullWidthFields = regularFields.filter(
    (f) => f.gridColumn === "full" || !f.gridColumn
  )
  const nonNotesHalfWidthFields = regularFields.filter((f) => f.gridColumn === "half")

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className={`${sizeClass} flex max-h-[90vh] flex-col p-0`}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>
            <FieldLegend>{config.title}</FieldLegend>
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
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
                  {/* Render non-notes full-width fields first */}
                  {nonNotesFullWidthFields.map((fieldConfig) => (
                    <FormField key={fieldConfig.name} config={fieldConfig} />
                  ))}

                  {/* Render non-notes half-width fields in a grid */}
                  {nonNotesHalfWidthFields.length > 0 && (
                    <div className="grid grid-cols-2 gap-4">
                      {nonNotesHalfWidthFields.map((fieldConfig) => (
                        <FormField
                          key={fieldConfig.name}
                          config={fieldConfig}
                        />
                      ))}
                    </div>
                  )}

                  {/* Always render notes field last if it exists */}
                  {notesField && (
                    <FormField key={notesField.name} config={notesField} />
                  )}
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
                  {isPending ? `${getActionText(config.action)}...` : config.title.split(" ")[0]}
                </Button>
              </DialogFooter>
            </form>
          </FormProvider>
        </div>
      </DialogContent>
    </Dialog>
  )
}