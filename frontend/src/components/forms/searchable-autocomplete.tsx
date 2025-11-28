"use client";

import * as React from "react";
import { Check, Plus, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useDebounce } from "@/hooks/use-debounce";

export type Option = {
  value: string;
  label: string;
  metadata?: Record<string, any>;
};

type SearchableAutocompleteProps = {
  options: Option[];
  value?: string;
  onChange?: (value: string, option?: Option) => void;
  placeholder?: string;
  isLoading?: boolean;
  onSearchChange?: (query: string) => void;
  allowCreate?: boolean;
  allowClear?: boolean;
  emptyText?: string;
  transformInput?: (val: string) => string;
  onBlur?: () => void;
};

function SkeletonList() {
  return (
    <div className="animate-pulse flex flex-col gap-2 p-2">
      <div className="h-7 w-full rounded bg-muted" />
      <div className="h-7 w-full rounded bg-muted" />
      <div className="h-7 w-full rounded bg-muted" />
    </div>
  );
}

export function SearchableAutocomplete({
  options,
  value,
  onChange,
  placeholder = "Type to search...",
  isLoading = false,
  onSearchChange,
  allowCreate = true,
  allowClear = true,
  emptyText = "No results found",
  transformInput = (val) => val,
  onBlur,
}: SearchableAutocompleteProps) {
  const [inputValue, setInputValue] = React.useState("");
  const [isFocused, setIsFocused] = React.useState(false);
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const debounced = useDebounce(inputValue);

  // Sync external value to input when not focused
  React.useEffect(() => {
    if (!isFocused) {
      setInputValue(value || "");
    }
  }, [value, isFocused]);

  React.useEffect(() => {
    onSearchChange?.(debounced);
  }, [debounced, onSearchChange]);

  const exactMatch = options.some(
    (o) => o.label.toLowerCase() === inputValue.toLowerCase()
  );

  const showDropdown = isFocused && inputValue.length > 0;

  const handleSelect = (val: string) => {
    const selectedOption = options.find((o) => o.value === val);
    onChange?.(val, selectedOption);
    setInputValue(selectedOption?.label || val);
    setIsFocused(false);
    setHighlightedIndex(-1);
  };

  const handleCreate = () => {
    if (!inputValue) return;
    onChange?.(inputValue);
    setIsFocused(false);
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange?.("", undefined);
    setInputValue("");
    inputRef.current?.focus();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const transformed = transformInput(e.target.value);
    setInputValue(transformed);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      // Allow Tab to move to next field when dropdown is closed
      if (e.key === "Tab") {
        return;
      }
      return;
    }

    const itemCount =
      (allowCreate && inputValue && !exactMatch ? 1 : 0) + options.length;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < itemCount - 1 ? prev + 1 : prev));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        break;
      case "Enter":
      case "Tab":  // Add Tab here
        e.preventDefault();
        if (highlightedIndex === -1) {
          // No selection, try to create if allowed
          if (inputValue && !exactMatch && allowCreate) {
            handleCreate();
          }
        } else if (
          highlightedIndex === 0 &&
          allowCreate &&
          inputValue &&
          !exactMatch
        ) {
          // First item is "create new"
          handleCreate();
        } else {
          // Select from options
          const offset = allowCreate && inputValue && !exactMatch ? 1 : 0;
          const selectedOption = options[highlightedIndex - offset];
          if (selectedOption) {
            handleSelect(selectedOption.value);
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsFocused(false);
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Delay blur to allow click events to fire first
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setIsFocused(false);
        setHighlightedIndex(-1);
        onBlur?.();
      }
    }, 150);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            "pr-8"
          )}
          autoComplete="off"
        />

        {/* Loading or Clear button */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {allowClear && value && !isLoading && (
            <button
              type="button"
              onClick={handleClear}
              className="h-4 w-4 rounded-sm opacity-50 hover:opacity-100 transition-opacity focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              aria-label="Clear selection"
              tabIndex={-1}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[300px] overflow-auto">
          {isLoading ? (
            <SkeletonList />
          ) : (
            <div className="py-1">
              {/* Create new option */}
              {allowCreate && inputValue && !exactMatch && (
                <div
                  className={cn(
                    "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                    highlightedIndex === 0 && "bg-accent text-accent-foreground"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    handleCreate();
                  }}
                  onMouseEnter={() => setHighlightedIndex(0)}
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    Create new: <strong>{inputValue}</strong>
                  </span>
                </div>
              )}

              {/* No results */}
              {options.length === 0 && !allowCreate && (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {emptyText}
                </div>
              )}

              {/* Options list */}
              {options.map((option, index) => {
                const offset = allowCreate && inputValue && !exactMatch ? 1 : 0;
                const itemIndex = index + offset;

                return (
                  <div
                    key={option.value}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                      highlightedIndex === itemIndex &&
                        "bg-accent text-accent-foreground",
                      option.value === value && "font-medium"
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent input blur
                      handleSelect(option.value);
                    }}
                    onMouseEnter={() => setHighlightedIndex(itemIndex)}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        option.value === value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {option.label}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
