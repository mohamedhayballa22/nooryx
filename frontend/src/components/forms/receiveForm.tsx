"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { OpenNewWindow } from "iconoir-react";
import { SearchableCombobox, Option } from "./searchable-combobox";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// Fake service function
async function fetchSkus(query: string) {
  await new Promise((r) => setTimeout(r, 800)); // simulate latency
  const data = [
    { sku_code: "SHIRT-BLK-M", sku_name: "Black Shirt Size M" },
    { sku_code: "SHIRT-WHT-L", sku_name: "White Shirt Size L" },
    { sku_code: "PANTS-BLU-32", sku_name: "Blue Pants 32" },
  ];

  return data.filter((sku) =>
    sku.sku_code.toLowerCase().includes(query.toLowerCase())
  );
}

async function fetchLocations(query: string) {
  await new Promise((r) => setTimeout(r, 600)); // simulate latency
  const data = [
    { location_code: "WAREHOUSE-A", location_name: "Main Warehouse A" },
    { location_code: "WAREHOUSE-B", location_name: "Secondary Warehouse B" },
    { location_code: "STORE-NYC", location_name: "NYC Retail Store" },
  ];

  return data.filter((loc) =>
    loc.location_code.toLowerCase().includes(query.toLowerCase())
  );
}

// Hooks
function useSkuSearch(query: string) {
  return useQuery({
    queryKey: ["skus", query],
    queryFn: () => fetchSkus(query),
    enabled: !!query,
    select: (data) =>
      data.map((sku) => ({
        value: sku.sku_code,
        label: sku.sku_code,
        metadata: { sku_name: sku.sku_name },
      })),
  });
}

function useLocationSearch(query: string) {
  return useQuery({
    queryKey: ["locations", query],
    queryFn: () => fetchLocations(query),
    enabled: !!query,
    select: (data) =>
      data.map((loc) => ({
        value: loc.location_code,
        label: loc.location_code,
        metadata: { location_name: loc.location_name },
      })),
  });
}

type ReceiveFormProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSubmit?: (payload: any) => void;
  sizeClass?: string;
};

type FormValues = {
  sku_code: string;
  sku_name: string;
  location: string;
  qty: number;
  cost_price: number;
  notes?: string;
};

const NOTES_MAX_LENGTH = 500;

export function ReceiveForm({
  open,
  onOpenChange,
  onSubmit,
  sizeClass = "max-w-lg",
}: ReceiveFormProps) {
  const [localOpen, setLocalOpen] = useState(false);
  const isControlled = typeof open === "boolean";
  const show = isControlled ? open! : localOpen;
  const setShow = (v: boolean) => {
    if (isControlled) onOpenChange?.(v);
    else setLocalOpen(v);
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
    trigger,
  } = useForm<FormValues>({
    defaultValues: {
      sku_code: "",
      sku_name: "",
      location: "",
      qty: 0,
      cost_price: 0,
      notes: "",
    },
  });

  // SKU code validation registration
  register("sku_code", {
    required: "SKU Code is required",
    maxLength: { value: 50, message: "SKU Code cannot exceed 50 characters" },
    minLength: {
      value: 3,
      message: "SKU Code must be at least 3 characters",
    },
    pattern: {
      value: /^[A-Z0-9-]+$/,
      message:
        "SKU must only contain letters, numbers, and dashes (no spaces or special characters)",
    },
  });

  // Location validation registration
  register("location", {
    required: "Location is required",
    maxLength: { value: 50, message: "Location cannot exceed 40 characters" },
    minLength: {
      value: 3,
      message: "Location must be at least 3 characters",
    },
    pattern: {
      value: /^[A-Z0-9-]+$/,
      message:
        "Location must only contain letters, numbers, and dashes (no spaces or special characters)",
    },
  });

  // SKU name validation registration
  register("sku_name", {
    required: "SKU Name is required",
    maxLength: { value: 80, message: "SKU Name cannot exceed 80 characters" },
    minLength: {
      value: 3,
      message: "SKU Name must be at least 3 characters",
    },
    pattern: {
      value: /^[A-Za-z0-9\s-]+$/,
      message:
        "SKU Name can only contain letters, numbers, spaces, and dashes",
    },
  });

  const onValid = (data: FormValues) => {
    // Destructure notes out so it doesn't appear at root level
    const { notes, ...rest } = data;

    // Build base payload
    const payload: any = {
        ...rest,
        sku_code: rest.sku_code.trim().toUpperCase(),
        location: rest.location.trim().toUpperCase(),
        action: "receive",
    };

    // Only include txn_metadata if notes were entered
    if (notes && notes.trim() !== "") {
        payload.txn_metadata = { notes: notes.trim() };
    }

    onSubmit?.(payload);
    reset();
    setShow(false);
    };

  // SKU search
  const [searchQuery, setSearchQuery] = useState("");
  const { data: skuOptions = [], isLoading: isLoadingSkus } =
    useSkuSearch(searchQuery);

  // Location search
  const [locationQuery, setLocationQuery] = useState("");
  const { data: locationOptions = [], isLoading: isLoadingLocations } =
    useLocationSearch(locationQuery);

  const handleSkuChange = (val: string, option?: Option) => {
    // Trim and uppercase before setting
    const formattedVal = val.trim().toUpperCase();
    setValue("sku_code", formattedVal, { shouldValidate: true });
    trigger("sku_code");

    if (option?.metadata?.sku_name) {
      setValue("sku_name", option.metadata.sku_name);
    } else {
      setValue("sku_name", "");
    }
  };

  const handleLocationChange = (val: string) => {
    const formattedVal = val.trim().toUpperCase();
    setValue("location", formattedVal, { shouldValidate: true });
    trigger("location");
  };

  const notesValue = watch("notes") || "";
  const notesLength = notesValue.length;

  return (
    <Dialog open={show} onOpenChange={setShow}>
      <DialogContent className={`${sizeClass} flex max-h-[90vh] flex-col p-0`}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>
            <FieldLegend>Receive Stock</FieldLegend>
          </DialogTitle>
          <DialogDescription>
            Record new inventory being received into a location.
          </DialogDescription>
        </DialogHeader>

        <div className="scrollable-form flex-1 overflow-y-auto px-6">
          <form
            onSubmit={handleSubmit(onValid)}
            className="mt-5 space-y-6 pb-6"
            noValidate
          >
            <FieldSet>
              <FieldGroup>
                {/* SKU CODE */}
                <Field>
                  <FieldLabel>SKU Code *</FieldLabel>
                  {errors.sku_code && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.sku_code.message}
                    </p>
                  )}
                  <FieldContent>
                    <SearchableCombobox
                      options={skuOptions}
                      value={watch("sku_code")}
                      onChange={handleSkuChange}
                      onSearchChange={setSearchQuery}
                      isLoading={isLoadingSkus}
                      placeholder="Select or create SKU"
                      searchPlaceholder="Search... (e.g. CHAIR-OFFICE-GRY)"
                      transformInput={(val) => val.toUpperCase()}
                    />
                  </FieldContent>
                  <FieldDescription>
                    {/* TODO: Redirect to correct SKUs docs page */}
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-sm hover:underline cursor-pointer"
                    >
                      Learn more about SKUs
                      <OpenNewWindow className="ml-1 h-4 w-4" />
                    </a>
                  </FieldDescription>
                </Field>

                {/* SKU NAME */}
                <Field>
                  <FieldLabel>SKU Name *</FieldLabel>
                  {errors.sku_name && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.sku_name.message}
                    </p>
                  )}
                  <FieldContent>
                    <Input
                      placeholder="e.g., Office Chair Grey Fabric"
                      {...register("sku_name")}
                    />
                  </FieldContent>
                </Field>

                {/* LOCATION */}
                <Field>
                  <FieldLabel>Location *</FieldLabel>
                  {errors.location && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.location.message}
                    </p>
                  )}
                  <FieldContent>
                    <SearchableCombobox
                      options={locationOptions}
                      value={watch("location")}
                      onChange={handleLocationChange}
                      onSearchChange={setLocationQuery}
                      isLoading={isLoadingLocations}
                      placeholder="Select or create location"
                      searchPlaceholder="Search location..."
                      transformInput={(val) => val.toUpperCase()}
                    />
                  </FieldContent>
                  <FieldDescription>
                    Where the inventory is being received.
                  </FieldDescription>
                </Field>

                {/* QTY & COST */}
                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel>Quantity *</FieldLabel>
                    {errors.qty && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.qty.message}
                      </p>
                    )}
                    <FieldContent>
                      <Input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="0"
                        {...register("qty", {
                          required: "Quantity is required",
                          valueAsNumber: true,
                          min: { value: 1, message: "Must be at least 1" },
                        })}
                      />
                    </FieldContent>
                    <FieldDescription>
                      Number of units received.
                    </FieldDescription>
                  </Field>

                  <Field>
                    {/* TODO: fetch currency from backend */}
                    <FieldLabel>Cost Price Per Unit (USD) *</FieldLabel>
                    {errors.cost_price && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.cost_price.message}
                      </p>
                    )}
                    <FieldContent>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...register("cost_price", {
                          required: "Cost price is required",
                          valueAsNumber: true,
                          min: {
                            value: 0.01,
                            message: "Must be greater than 0",
                          },
                        })}
                      />
                    </FieldContent>
                    <FieldDescription>
                        {/* TODO: Redirect to correct valuation docs page */}
                      <a
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-sm hover:underline cursor-pointer"
                      >
                        Learn more about valuation
                        <OpenNewWindow className="ml-1 h-4 w-4" />
                      </a>
                    </FieldDescription>
                  </Field>
                </div>

                {/* NOTES */}
                <Field>
                  <FieldLabel>Notes</FieldLabel>
                  <FieldContent>
                    <Textarea
                      placeholder="Optional notes or remarks"
                      className="resize-none"
                      maxLength={NOTES_MAX_LENGTH}
                      {...register("notes", {
                        maxLength: {
                          value: NOTES_MAX_LENGTH,
                          message: `Notes must be ${NOTES_MAX_LENGTH} characters or less`,
                        },
                      })}
                    />
                  </FieldContent>
                  <FieldDescription>
                    <span
                      className={cn(
                        "text-xs",
                        notesLength > NOTES_MAX_LENGTH * 0.9 &&
                          "text-amber-600",
                        notesLength === NOTES_MAX_LENGTH && "text-red-600"
                      )}
                    >
                      {notesLength}/{NOTES_MAX_LENGTH}
                    </span>
                  </FieldDescription>
                  {errors.notes && (
                    <p className="text-xs text-red-500 mt-1">
                      {errors.notes.message}
                    </p>
                  )}
                </Field>
              </FieldGroup>
            </FieldSet>

            <DialogFooter className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => setShow(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Receive</Button>
            </DialogFooter>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
