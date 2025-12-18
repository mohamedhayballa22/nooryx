"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { Suspense, useMemo, useEffect } from "react"
import { InvitationForm } from "./components/invitation-form"
import { InvitationError } from "./components/invitation-error"
import { InvitationLoading } from "./components/invitation-loading"
import { parseInvitationToken } from "@/hooks/use-invitation"
import { useAuth } from "@/lib/auth"

function InvitationContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const token = searchParams.get("token")

  const { data, error } = useMemo(() => parseInvitationToken(token), [token])

  // Redirect logged-in users
  useEffect(() => {
    if (!authLoading && user) {
      // If user is logged in, redirect to dashboard
      router.push("/core/dashboard")
    }
  }, [user, authLoading, router])

  // Show loading while checking auth
  if (authLoading) {
    return <InvitationLoading />
  }

  // Don't render form if user is logged in (redirect will happen)
  if (user) {
    return null
  }

  if (!token) {
    return (
      <InvitationError
        title="Missing invitation token"
        message="No invitation token was provided. Please use the link from your invitation email."
      />
    )
  }

  if (error || !data) {
    return <InvitationError message={error || "This invitation link is invalid or has expired."} />
  }

  return <InvitationForm token={token} email={data.email} orgName={data.org_name} />
}

export default function InvitationPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <Suspense fallback={<InvitationLoading />}>
              <InvitationContent />
            </Suspense>
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src="/dashboard.png"
          alt="Team collaboration"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  )
}
