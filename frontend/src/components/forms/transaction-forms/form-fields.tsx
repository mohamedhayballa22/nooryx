"use client"

import React, { useState } from "react"
import { Controller, useFormContext } from "react-hook-form"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { OpenNewWindow } from "iconoir-react"
import { SearchableAutocomplete, Option } from "../searchable-autocomplete"
import { useSkuSearch } from "../hooks/use-sku-search"
import { useLocationSearch } from "../hooks/use-location-search"
import { cn } from "@/lib/utils"
import { NOTES_MAX_LENGTH } from "./validation-schemas"
import type { FieldConfig } from "./types"

interface FormFieldProps {
  config: FieldConfig
}

export function FormField({ config }: FormFieldProps) {
  const {
    register,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useFormContext()

  const error = errors[config.name]

  switch (config.type) {
    case "autocomplete":
      if (config.name === "sku_code") {
        return <SkuCodeField config={config} />
      }
      if (config.name === "location" || config.name === "target_location") {
        return <LocationField config={config} />
      }
      return null

    case "textarea":
      if (config.name === "notes") {
        return <NotesField config={config} />
      }
      return <TextareaField config={config} />

    case "select":
      return <SelectField config={config} />

    case "number":
      return <NumberField config={config} />

    case "text":
    default:
      return <TextField config={config} />
  }
}

function TextField({ config }: FormFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext()
  const error = errors[config.name]

  return (
    <Field>
      <FieldLabel>
        {config.label} {config.required && "*"}
      </FieldLabel>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error.message as string}</p>
      )}
      <FieldContent>
        <Input
          placeholder={config.placeholder}
          {...register(config.name, config.validation)}
        />
      </FieldContent>
      {config.description && (
        <FieldDescription>{config.description}</FieldDescription>
      )}
    </Field>
  )
}

function NumberField({ config }: FormFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext()
  const error = errors[config.name]

  return (
    <Field>
      <FieldLabel>
        {config.label} {config.required && "*"}
      </FieldLabel>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error.message as string}</p>
      )}
      <FieldContent>
        <Input
          type="number"
          step={config.name === "cost_price" ? "0.01" : "1"}
          placeholder={config.placeholder || "0"}
          {...register(config.name, config.validation)}
        />
      </FieldContent>
      {config.description && (
        <FieldDescription>
          {config.learnMoreLink ? ( // Add a check for config.learnMoreLink
            <a
              href={config.learnMoreLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm hover:underline cursor-pointer"
            >
              {config.description}
              <OpenNewWindow className="ml-1 h-4 w-4" />
            </a>
          ) : (
            config.description
          )}
        </FieldDescription>
      )}
    </Field>
  )
}

function TextareaField({ config }: FormFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext()
  const error = errors[config.name]

  return (
    <Field>
      <FieldLabel>
        {config.label} {config.required && "*"}
      </FieldLabel>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error.message as string}</p>
      )}
      <FieldContent>
        <Textarea
          placeholder={config.placeholder}
          className="resize-none"
          {...register(config.name, config.validation)}
        />
      </FieldContent>
      {config.description && (
        <FieldDescription>{config.description}</FieldDescription>
      )}
    </Field>
  )
}

function SelectField({ config }: FormFieldProps) {
  const {
    control,
    formState: { errors },
  } = useFormContext()
  const error = errors[config.name]

  return (
    <Field>
      <FieldLabel>
        {config.label} {config.required && "*"}
      </FieldLabel>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error.message as string}</p>
      )}
      <FieldContent>
        <Controller
          name={config.name}
          control={control}
          rules={config.validation}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder={config.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {config.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </FieldContent>
      {config.description && (
        <FieldDescription>{config.description}</FieldDescription>
      )}
    </Field>
  )
}

function SkuCodeField({ config }: FormFieldProps) {
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext()
  const error = errors[config.name]

  const [searchQuery, setSearchQuery] = useState("")
  const { data: skuOptions = [], isLoading: isLoadingSkus } =
    useSkuSearch(searchQuery)

  const handleSkuChange = (val: string, option?: Option) => {
    const formattedVal = val.trim().toUpperCase()
    setValue(config.name, formattedVal, { shouldValidate: true })

    if (option?.metadata?.sku_name) {
      setValue("sku_name", option.metadata.sku_name)
    } else {
      setValue("sku_name", "")
    }
  }

  return (
    <Field>
      <FieldLabel>
        {config.label} {config.required && "*"}
      </FieldLabel>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error.message as string}</p>
      )}
      <FieldContent>
        <Controller
          name={config.name}
          control={control}
          rules={config.validation}
          render={({ field }) => (
            <SearchableAutocomplete
              options={skuOptions}
              value={field.value}
              onChange={handleSkuChange}
              onSearchChange={setSearchQuery}
              isLoading={isLoadingSkus}
              placeholder={config.placeholder || "Type to search SKU..."}
              transformInput={(val) => val.toUpperCase()}
            />
          )}
        />
      </FieldContent>
      {config.description && (
        <FieldDescription>
          {config.learnMoreLink ? ( // Add a check for config.learnMoreLink
            <a
              href={config.learnMoreLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm hover:underline cursor-pointer"
            >
              {config.description}
              <OpenNewWindow className="ml-1 h-4 w-4" />
            </a>
          ) : (
            config.description
          )}
        </FieldDescription>
      )}
    </Field>
  )
}

function LocationField({ config }: FormFieldProps) {
  const {
    control,
    setValue,
    formState: { errors },
  } = useFormContext()
  const error = errors[config.name]

  const [locationQuery, setLocationQuery] = useState("")
  const { data: locationOptions = [], isLoading: isLoadingLocations } =
    useLocationSearch(locationQuery)

  const handleLocationChange = (val: string) => {
    const formattedVal = val.trim().toUpperCase()
    setValue(config.name, formattedVal, { shouldValidate: true })
  }

  return (
    <Field>
      <FieldLabel>
        {config.label} {config.required && "*"}
      </FieldLabel>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error.message as string}</p>
      )}
      <FieldContent>
        <Controller
          name={config.name}
          control={control}
          rules={config.validation}
          render={({ field }) => (
            <SearchableAutocomplete
              options={locationOptions}
              value={field.value}
              onChange={handleLocationChange}
              onSearchChange={setLocationQuery}
              isLoading={isLoadingLocations}
              placeholder={config.placeholder || "Type to search location..."}
              transformInput={(val) => val.toUpperCase()}
            />
          )}
        />
      </FieldContent>
      {config.description && (
        <FieldDescription>{config.description}</FieldDescription>
      )}
    </Field>
  )
}

function NotesField({ config }: FormFieldProps) {
  const {
    register,
    watch,
    formState: { errors },
  } = useFormContext()
  const error = errors[config.name]

  const notesValue = watch(config.name) || ""
  const notesLength = notesValue.length

  return (
    <Field>
      <FieldLabel>{config.label}</FieldLabel>
      <FieldContent>
        <Textarea
          placeholder={config.placeholder || "Optional notes or remarks"}
          className="resize-none"
          maxLength={NOTES_MAX_LENGTH}
          {...register(config.name, config.validation)}
        />
      </FieldContent>
      <FieldDescription>
        <span
          className={cn(
            "text-xs",
            notesLength > NOTES_MAX_LENGTH * 0.9 && "text-amber-600",
            notesLength === NOTES_MAX_LENGTH && "text-red-600"
          )}
        >
          {notesLength}/{NOTES_MAX_LENGTH}
        </span>
      </FieldDescription>
      {error && (
        <p className="text-xs text-red-500 mt-1">{error.message as string}</p>
      )}
    </Field>
  )
}
