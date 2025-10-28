"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useDebounce } from "@/hooks/use-debounce";

export type Option = {
  value: string;
  label: string;
  metadata?: Record<string, any>;
};

type SearchableComboboxProps = {
  options: Option[];
  value?: string;
  onChange?: (value: string, option?: Option) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  isLoading?: boolean;
  onSearchChange?: (query: string) => void;
  allowCreate?: boolean;
  allowClear?: boolean;
  emptyText?: string;
  transformInput?: (val: string) => string;
};

function SkeletonList() {
  return (
    <div className="animate-pulse flex flex-col gap-3 px-2 py-3">
      <div className="h-6 w-50 rounded bg-muted" />
      <div className="h-6 w-50 rounded bg-muted" />
      <div className="h-6 w-50 rounded bg-muted" />
    </div>
  );
}

export function SearchableCombobox({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search or create...",
  isLoading = false,
  onSearchChange,
  allowCreate = true,
  allowClear = true,
  emptyText = "No results found",
  transformInput = (val) => val.toUpperCase(),
}: SearchableComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  const debounced = useDebounce(inputValue);

  React.useEffect(() => {
    if (debounced) {
      onSearchChange?.(debounced);
    }
  }, [debounced, onSearchChange]);

  const exactMatch = options.some(
    (o) => o.label.toLowerCase() === inputValue.toLowerCase()
  );

  const handleSelect = (val: string) => {
    const selectedOption = options.find((o) => o.value === val);
    onChange?.(val, selectedOption);
    setOpen(false);
  };

  const handleCreate = () => {
    if (!inputValue) return;
    onChange?.(inputValue);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange?.("", undefined);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue && !exactMatch && allowCreate) {
      e.preventDefault();
      handleCreate();
    }
  };

  const handleInputChange = (val: string) => {
    const transformed = transformInput(val);
    setInputValue(transformed);
  };

  return (
    <div className="relative w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between text-left font-normal cursor-default",
              !value && "text-muted-foreground",
              allowClear && value && "pr-10"
            )}
          >
            <span className="truncate">{value || placeholder}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={searchPlaceholder}
              value={inputValue}
              onValueChange={handleInputChange}
              onKeyDown={handleKeyDown}
            />

            {(isLoading || inputValue || options.length > 0) && (
              <CommandList>
                {isLoading ? (
                  <SkeletonList />
                ) : (
                  <CommandGroup>
                    {allowCreate && inputValue && !exactMatch && (
                      <div
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                        onClick={handleCreate}
                      >
                        <Plus className="h-4 w-4" />
                        Create new: <strong>{inputValue}</strong>
                      </div>
                    )}

                    {options.length === 0 && !allowCreate && (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        {emptyText}
                      </div>
                    )}

                    {options.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => handleSelect(option.value)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            option.value === value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            )}
          </Command>
        </PopoverContent>
      </Popover>

      {allowClear && value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-8 top-1/2 -translate-y-1/2 h-4 w-4 rounded-sm opacity-50 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          aria-label="Clear selection"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
