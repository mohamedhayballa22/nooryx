"use client";

import GuestNavbar from "@/components/guest-navbar";
import { useAuth } from "@/lib/auth";
import { AuthLoading } from "@/components/auth-loading";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/core/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <AuthLoading />;
  }

  if (isAuthenticated) {
    return null; // Redirecting...
  }

  return (
    <div className="min-h-screen flex flex-col">
      <GuestNavbar />

      {/* Main content (pushed down because Navbar is fixed) */}
      <main className="flex-1 pt-20">{children}</main>
    </div>
  );
}
