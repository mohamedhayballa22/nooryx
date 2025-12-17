"use client"

import { WaitlistForm } from "./components/waitlist-form"

export default function WaitlistPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start"></div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <WaitlistForm />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <img
          src="/dashboard.png"
          alt="Inventory Management Dashboard"
          className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  )
}
