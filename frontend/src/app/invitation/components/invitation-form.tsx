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
  const router = useRouter()
  const { checkAuth } = useAuth()

  const { mutate: acceptInvitation, isPending, error } = useAcceptInvitation()

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
      },
    )
  }

  const apiError = error?.message || (error as any)?.response?.data?.detail

  return (
    <form className={cn("flex flex-col gap-6", className)} onSubmit={handleSubmit} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Join {orgName}</h1>
          <p className="text-muted-foreground text-sm text-balance">Complete your profile to accept the invitation</p>
        </div>

        {apiError && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
            {apiError}
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
