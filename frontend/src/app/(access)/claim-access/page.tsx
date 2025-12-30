"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useMemo, useEffect } from "react"
import { ClaimAccessForm } from "./components/claim-access-form"
import { ClaimAccessError } from "./components/claim-access-error"
import { ClaimAccessLoading } from "./components/claim-access-loading"
import { parseAccessToken } from "@/hooks/use-access-claim"
import { useAuth } from "@/lib/auth"

function ClaimAccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const token = searchParams.get("token")

  const { data, error } = useMemo(() => parseAccessToken(token), [token])

  // Redirect logged-in users
  useEffect(() => {
    if (!authLoading && user) {
      // If user is logged in, redirect to dashboard
      router.push("/core/dashboard")
    }
  }, [user, authLoading, router])

  // Show loading while checking auth
  if (authLoading) {
    return <ClaimAccessLoading />
  }

  // Don't render form if user is logged in (redirect will happen)
  if (user) {
    return null
  }

  if (!token) {
    return (
      <ClaimAccessError
        title="Missing access token"
        message="No access token was provided. Please use the link from your access grant email."
      />
    )
  }

  if (error || !data) {
    return <ClaimAccessError message={error || "This access link is invalid or has expired."} />
  }

  return (
    <ClaimAccessForm 
      token={token} 
      email={data.email} 
      subscriptionMonths={data.subscription_months}
    />
  )
}

export default function ClaimAccessPage() {
  return (
    <Suspense fallback={<ClaimAccessLoading />}>
      <ClaimAccessContent />
    </Suspense>
  )
}
