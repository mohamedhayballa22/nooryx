"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { useAcceptInvitation } from "@/hooks/use-invitation"
import { authApi } from "@/lib/api/auth"
import { useAuth } from "@/lib/auth"
import Link from "next/link"
import { AlertCircle, AlertTriangle } from "lucide-react"

interface ErrorState {
  title: string
  description: string | React.ReactNode
  type: "error" | "warning"
}

interface InvitationFormProps extends React.ComponentProps<"form"> {
  token: string
  email: string
  orgName: string
}

export function InvitationForm({ className, token, email, orgName, ...props }: InvitationFormProps) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [errorState, setErrorState] = useState<ErrorState | null>(null)
  const router = useRouter()
  const { checkAuth } = useAuth()

  const { mutate: acceptInvitation, isPending } = useAcceptInvitation()

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

    // Get error detail from response
    const detail = err?.response?.data?.detail || err.message || ""
    const statusCode = err?.response?.status

    // Handle invitation-specific errors
    if (detail.includes("Invalid or expired invitation")) {
      return {
        title: "Invalid Invitation",
        description: "This invitation link has expired or is no longer valid. Please request a new invitation.",
        type: "error",
      }
    }

    if (detail.includes("User already registered") || detail.includes("already registered")) {
      // Use a ReactNode for the description to include the Link component
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
        title: "Account Already Exists",
        description: loginLink,
        type: "warning",
      }
    }

    if (detail.includes("invitation invalid")) {
      return {
        title: "Invalid Invitation",
        description: "This invitation cannot be used. Please contact your workspace administrator.",
        type: "error",
      }
    }

    if (detail.includes("Registration failed")) {
      // Extract specific error if available
      const match = detail.match(/Registration failed: (.+)/)
      const reason = match ? match[1] : "Please check your information and try again."
      return {
        title: "Registration Failed",
        description: reason,
        type: "error",
      }
    }

    // Password validation errors from backend
    if (detail.toLowerCase().includes("password")) {
      return {
        title: "Invalid Password",
        description: "Please ensure your password meets the requirements and try again.",
        type: "error",
      }
    }

    // Handle network errors
    if (!err?.response) {
      return {
        title: "Connection Error",
        description: "Unable to reach the server. Please check your internet connection and try again.",
        type: "error",
      }
    }

    // Handle server errors (5xx)
    if (statusCode >= 500) {
      return {
        title: "Server Error",
        description: "Something went wrong on our end. Please try again in a moment.",
        type: "error",
      }
    }

    // Generic error fallback
    return {
      title: "Something Went Wrong",
      description: "We couldn't complete your registration. Please try again.",
      type: "error",
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!firstName.trim()) {
      errors.firstName = "First name is required"
    } else if (firstName.length > 50) {
      errors.firstName = "First name must be 50 characters or less"
    }

    if (!lastName.trim()) {
      errors.lastName = "Last name is required"
    } else if (lastName.length > 50) {
      errors.lastName = "Last name must be 50 characters or less"
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setErrorState(null)

    if (!validateForm()) return

    acceptInvitation(
      {
        token,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        password,
      },
      {
        onSuccess: async (data) => {
          try {
            // Auto-login after successful account creation
            await authApi.login({
              username: data.email,
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
          <h1 className="text-2xl font-bold">Join {orgName}</h1>
          <p className="text-muted-foreground text-sm text-balance">Complete your profile to accept the invitation</p>
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
                {/* Render description, which can now be a string or a ReactNode */}
                <p className="text-sm opacity-90">{errorState.description}</p>
              </div>
            </div>
          </div>
        )}

        <Field data-invalid={!!validationErrors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" value={email} disabled className="bg-muted cursor-not-allowed" />
          <FieldDescription>This email was used for your invitation</FieldDescription>
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
              disabled={isPending}
              maxLength={50}
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
              disabled={isPending}
              maxLength={50}
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
            disabled={isPending}
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
            disabled={isPending}
            aria-invalid={!!validationErrors.confirmPassword}
          />
          {validationErrors.confirmPassword && <FieldError>{validationErrors.confirmPassword}</FieldError>}
        </Field>

        <Field>
          <Button type="submit" className="cursor-pointer" disabled={isPending}>
            {isPending ? "Joining..." : "Accept invitation"}
          </Button>
        </Field>

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
