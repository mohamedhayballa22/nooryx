"use client";

import GuestNavbar from "@/components/guest-navbar";
import { useAuth } from "@/lib/auth";
import { AuthLoading } from "@/components/auth-loading";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  const isRootPage = pathname === "/";

  useEffect(() => {
    // Only redirect from root page
    if (isRootPage && !isLoading && isAuthenticated) {
      router.push("/core/dashboard");
    }
  }, [isRootPage, isLoading, isAuthenticated, router]);

  // For root page: don't show anything while checking or redirecting
  if (isRootPage) {
    if (isLoading) {
      return <AuthLoading />;
    }
    if (isAuthenticated) {
      return null; // Redirecting...
    }
  }

  // For all other guest routes: render normally
  return (
    <div className="min-h-screen flex flex-col">
      <GuestNavbar />
      <main className="flex-1 pt-20">{children}</main>
    </div>
  );
}
