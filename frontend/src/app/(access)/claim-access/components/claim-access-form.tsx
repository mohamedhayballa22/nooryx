"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldError, FieldContent, FieldSet, FieldTitle } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useState, type FormEvent, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useClaimAccess } from "@/hooks/use-access-claim"
import { authApi } from "@/lib/api/auth"
import { useAuth } from "@/lib/auth"
import Link from "next/link"
import { AlertCircle, AlertTriangle, ChevronLeft } from "lucide-react"
import { OpenNewWindow } from "iconoir-react"
import currencyCodes from "currency-codes"
import { Check, ChevronsUpDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"

interface ErrorState {
  title: string
  description: string | React.ReactNode
  type: "error" | "warning"
}

interface ClaimAccessFormProps extends React.ComponentProps<"form"> {
  token: string
  email: string
  subscriptionMonths: number
}

// Codes to exclude (Precious metals, testing codes, bond markets, supra-national funds not in common circulation)
const EXCLUDED_CURRENCIES = new Set([
  "XAU", "XAG", "XPT", "XPD", // Precious Metals (Gold, Silver, Platinum, Palladium)
  "XTS", "XXX",               // Testing & No Currency
  "XBA", "XBB", "XBC", "XBD", // European Composite Units (Bond Markets)
  "XDR",                      // Special Drawing Rights (IMF)
  "XSU",                      // Sucre
  "XUA",                      // ADB Unit of Account
])

type Step = 1 | 2

export function ClaimAccessForm({ 
  className, 
  token, 
  email, 
  subscriptionMonths,
  ...props 
}: ClaimAccessFormProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  
  // Personal Information
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  
  // Workspace Information
  const [companyName, setCompanyName] = useState("")
  const [valuationMethod, setValuationMethod] = useState<"FIFO" | "LIFO" | "WAC" | "">("")
  const [currency, setCurrency] = useState("")
  const [customCurrency, setCustomCurrency] = useState("")
  const [showCustomCurrency, setShowCustomCurrency] = useState(false)
  const [openCurrencyCombobox, setOpenCurrencyCombobox] = useState(false)
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [errorState, setErrorState] = useState<ErrorState | null>(null)
  const [isStep2Valid, setIsStep2Valid] = useState(false)
  
  const router = useRouter()
  const { checkAuth } = useAuth()
  const { mutate: claimAccess, isPending } = useClaimAccess()

  // Memoize the filtered currency list to prevent recalculation on every render
  const allCurrencies = useMemo(() => {
    return currencyCodes.data
      .filter((c) => !EXCLUDED_CURRENCIES.has(c.code))
      .map((c) => ({
        code: c.code,
        name: c.currency,
      }))
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [])

  const variantStyles =
    errorState?.type === "warning"
      ? "bg-muted border-border text-foreground"
      : "bg-destructive/10 border-destructive/20 text-destructive"

  const parseError = (err: any): ErrorState => {
    // Handle rate limiting (429)
    if (err?.status === 429) {
      const retryAfter = err?.response?.data?.retry_after || 60
      return {
        title: "Too Many Attempts",
        description: `Please wait ${retryAfter} seconds before trying again.`,
        type: "warning",
      }
    }

    const detail = err?.response?.data?.detail || err.message || ""
    const statusCode = err?.response?.status

    // Handle access-specific errors
    if (detail.includes("Invalid access token") || detail.includes("expired")) {
      return {
        title: "Invalid Access Token",
        description: "This access link has expired or is no longer valid. Please contact support.",
        type: "error",
      }
    }

    if (detail.includes("User already exists") || detail.includes("Access already claimed")) {
      const loginLink = (
        <>
          An account with this email already exists. Try{" "}
          <Link href="/login" className="underline underline-offset-4 font-medium">
            logging in
          </Link>{" "}
          instead.
        </>
      )
      return {
        title: "Access Already Claimed",
        description: loginLink,
        type: "warning",
      }
    }

    if (detail.includes("Invalid email in token")) {
      return {
        title: "Email Mismatch",
        description: "The email doesn't match the access token. Please use the correct email address.",
        type: "error",
      }
    }

    if (detail.includes("Failed to create workspace")) {
      return {
        title: "Workspace Creation Failed",
        description: "We couldn't set up your workspace. Please try again or contact support.",
        type: "error",
      }
    }

    // Password validation errors
    if (detail.toLowerCase().includes("password")) {
      return {
        title: "Invalid Password",
        description: "Please ensure your password meets the requirements and try again.",
        type: "error",
      }
    }

    // Network errors
    if (!err?.response) {
      return {
        title: "Connection Error",
        description: "Unable to reach the server. Please check your internet connection and try again.",
        type: "error",
      }
    }

    // Server errors (5xx)
    if (statusCode >= 500) {
      return {
        title: "Server Error",
        description: "Something went wrong on our end. Please try again in a moment.",
        type: "error",
      }
    }

    return {
      title: "Something Went Wrong",
      description: "We couldn't complete your workspace setup. Please try again.",
      type: "error",
    }
  }

  const validateStep1 = (): boolean => {
    const errors: Record<string, string> = {}

    if (!firstName.trim()) {
      errors.firstName = "First name is required"
    } else if (firstName.length > 100) {
      errors.firstName = "First name must be 100 characters or less"
    }

    if (!lastName.trim()) {
      errors.lastName = "Last name is required"
    } else if (lastName.length > 100) {
      errors.lastName = "Last name must be 100 characters or less"
    }

    if (!password) {
      errors.password = "Password is required"
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters"
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match"
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validateStep2 = (showErrors: boolean = true): boolean => {
    const errors: Record<string, string> = {}

    if (!companyName.trim()) {
      errors.companyName = "Company name is required"
    } else if (companyName.length > 255) {
      errors.companyName = "Company name must be 255 characters or less"
    }

    if (!valuationMethod) {
      errors.valuationMethod = "Please select an inventory valuation method"
    }

    const finalCurrency = showCustomCurrency ? customCurrency.trim().toUpperCase() : currency
    if (!finalCurrency) {
      errors.currency = "Currency is required"
    } else if (finalCurrency.length !== 3) {
      errors.currency = "Currency code must be exactly 3 characters (e.g., USD)"
    }

    if (showErrors) {
      setValidationErrors(errors)
    }
    return Object.keys(errors).length === 0
  }

  // Check step 2 validity whenever relevant fields change
  useEffect(() => {
    if (currentStep === 2) {
      const isValid = validateStep2(false)
      setIsStep2Valid(isValid)
    }
  }, [companyName, valuationMethod, currency, customCurrency, showCustomCurrency, currentStep])

  const handleContinue = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    setErrorState(null)
    
    if (validateStep1()) {
      setCurrentStep(2)
    }
  }

  const handleBack = () => {
    setErrorState(null)
    setValidationErrors({})
    setCurrentStep(1)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorState(null)

    if (!validateStep2()) return

    const finalCurrency = showCustomCurrency ? customCurrency.trim().toUpperCase() : currency

    claimAccess(
      {
        token,
        email,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        password,
        company_name: companyName.trim(),
        valuation_method: valuationMethod as "FIFO" | "LIFO" | "WAC",
        currency: finalCurrency,
      },
      {
        onSuccess: async () => {
          try {
            // Auto-login after successful workspace creation
            await authApi.login({
              username: email,
              password,
            })

            // Acquire refresh token
            await authApi.issueRefresh()

            // Get user data and update context
            await checkAuth()

            // Redirect to dashboard
            router.push("/core/dashboard")
          } catch (err: any) {
            // If auto-login fails, redirect to login page
            router.push("/login")
          }
        },
        onError: (err: any) => {
          const error = parseError(err)
          setErrorState(error)
        },
      },
    )
  }

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-medium text-muted-foreground">
              Step {currentStep} of 2
            </span>
          </div>
        </div>

        {errorState && (
          <div
            className={cn(
              "rounded-lg border p-4 animate-in fade-in slide-in-from-top-2 duration-300",
              variantStyles,
            )}
          >
            <div className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {errorState.type === "warning" ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <AlertCircle className="h-5 w-5" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">{errorState.title}</p>
                <p className="text-sm opacity-90">{errorState.description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Personal Information */}
        {currentStep === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <Field data-invalid={!!validationErrors.email}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input 
                id="email" 
                type="email" 
                value={email} 
                disabled 
                className="bg-muted cursor-not-allowed" 
              />
              <FieldDescription>This email was provided with your access grant</FieldDescription>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!validationErrors.firstName}>
                <FieldLabel htmlFor="firstName">First name</FieldLabel>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="John"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={100}
                  aria-invalid={!!validationErrors.firstName}
                />
                {validationErrors.firstName && <FieldError>{validationErrors.firstName}</FieldError>}
              </Field>

              <Field data-invalid={!!validationErrors.lastName}>
                <FieldLabel htmlFor="lastName">Last name</FieldLabel>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Doe"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  maxLength={100}
                  aria-invalid={!!validationErrors.lastName}
                />
                {validationErrors.lastName && <FieldError>{validationErrors.lastName}</FieldError>}
              </Field>
            </div>

            <Field data-invalid={!!validationErrors.password}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                aria-invalid={!!validationErrors.password}
              />
              <FieldDescription>Must be at least 8 characters</FieldDescription>
              {validationErrors.password && <FieldError>{validationErrors.password}</FieldError>}
            </Field>

            <Field data-invalid={!!validationErrors.confirmPassword}>
              <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
              <Input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                aria-invalid={!!validationErrors.confirmPassword}
              />
              {validationErrors.confirmPassword && (
                <FieldError>{validationErrors.confirmPassword}</FieldError>
              )}
            </Field>

            <Field>
              <Button type="button" className="w-full cursor-pointer" onClick={handleContinue}>
                Continue
              </Button>
            </Field>
          </div>
        )}

        {/* Step 2: Workspace Configuration */}
        {currentStep === 2 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex gap-3 p-4 rounded-lg border-2 border-foreground/20 bg-background">
              <div className="flex-1">
                <p className="text-xs font-semibold text-foreground mb-1">
                  Important: Permanent Settings
                </p>
                <p className="text-xs text-muted-foreground">
                  Your currency and valuation method cannot be changed once you start recording stock movements.{" "}
                  <Link 
                    href="/docs/core-concepts/valuation" 
                    className="underline underline-offset-4 hover:text-foreground inline-flex items-center gap-1"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Read more
                    <OpenNewWindow className="h-3 w-3 mt-0.5" />
                  </Link>
                </p>
              </div>
            </div>

            <Field data-invalid={!!validationErrors.companyName}>
              <FieldLabel htmlFor="companyName">Company name</FieldLabel>
              <Input
                id="companyName"
                type="text"
                placeholder="Acme Inc."
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isPending}
                maxLength={255}
                aria-invalid={!!validationErrors.companyName}
              />
              {validationErrors.companyName && <FieldError>{validationErrors.companyName}</FieldError>}
            </Field>

            <FieldSet data-invalid={!!validationErrors.valuationMethod}>
              <FieldLabel htmlFor="valuation-method">Inventory valuation method</FieldLabel>
              <RadioGroup
                value={valuationMethod}
                onValueChange={(value: string) => setValuationMethod(value as "FIFO" | "LIFO" | "WAC")}
                disabled={isPending}
              >
                <FieldLabel htmlFor="wac">
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>Weighted Average Cost (WAC)</FieldTitle>
                      <FieldDescription>
                        Averages cost across all inventory
                      </FieldDescription>
                    </FieldContent>
                    <RadioGroupItem value="WAC" id="wac" />
                  </Field>
                </FieldLabel>
                
                <FieldLabel htmlFor="fifo">
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>FIFO (First In, First Out)</FieldTitle>
                      <FieldDescription>
                        Assumes oldest inventory is sold first
                      </FieldDescription>
                    </FieldContent>
                    <RadioGroupItem value="FIFO" id="fifo" />
                  </Field>
                </FieldLabel>
                
                <FieldLabel htmlFor="lifo">
                  <Field orientation="horizontal">
                    <FieldContent>
                      <FieldTitle>LIFO (Last In, First Out)</FieldTitle>
                      <FieldDescription>
                        Assumes newest inventory is sold first
                      </FieldDescription>
                    </FieldContent>
                    <RadioGroupItem value="LIFO" id="lifo" />
                  </Field>
                </FieldLabel>
              </RadioGroup>
              {validationErrors.valuationMethod && (
                <FieldError>{validationErrors.valuationMethod}</FieldError>
              )}
            </FieldSet>

            <Field data-invalid={!!validationErrors.currency}>
              <FieldLabel htmlFor="currency">Base currency</FieldLabel>
                  <Popover open={openCurrencyCombobox} onOpenChange={setOpenCurrencyCombobox}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={openCurrencyCombobox}
                        disabled={isPending}
                        className="w-full justify-between font-normal"
                      >
                        {currency
                          ? `${currency} — ${
                              allCurrencies.find((c) => c.code === currency)?.name
                            }`
                          : "Select currency"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent className="w-full p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
                      <Command className="w-full">
                        <CommandInput placeholder="Search currency..." />
                        <CommandEmpty>No currency found.</CommandEmpty>

                        <CommandGroup className="max-h-64 overflow-y-auto">
                          {allCurrencies.map((curr) => (
                            <CommandItem
                              key={curr.code}
                              value={`${curr.code} ${curr.name}`}
                              onSelect={() => {
                                setCurrency(curr.code)
                                setOpenCurrencyCombobox(false)
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  currency === curr.code ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {curr.code} — {curr.name}
                                </span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
              {validationErrors.currency && <FieldError>{validationErrors.currency}</FieldError>}
            </Field>

            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="outline" 
                className="cursor-pointer" 
                onClick={handleBack}
                disabled={isPending}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
              <Button 
                type="submit" 
                className="flex-1 cursor-pointer" 
                disabled={isPending || !isStep2Valid}
              >
                {isPending ? "Creating workspace..." : "Create workspace"}
              </Button>
            </div>
          </div>
        )}

        <Field>
          <FieldDescription className="text-center">
            Already have an account?{" "}
            <Link href="/login" className="underline underline-offset-4">
              Sign in
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  )
}
