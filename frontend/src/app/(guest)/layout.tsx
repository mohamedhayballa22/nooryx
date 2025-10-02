import type { Metadata } from "next"
import GuestNavbar from "@/components/guest-navbar"

export const metadata: Metadata = {
  title: "Nooryx",
  description: "Inventory management made easy",
}

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <GuestNavbar />

      {/* Main content (pushed down because Navbar is fixed) */}
      <main className="flex-1 pt-20">{children}</main>
    </div>
  )
}
