"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { CoreNavbar } from "@/components/core-navbar";
import { useAuth } from "@/lib/auth";
import { AuthLoading } from "@/components/auth-loading";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return <AuthLoading />;
  }

  if (!isAuthenticated) {
    return null; // Redirecting...
  }

  return (
    <SidebarProvider>
      <div className="flex w-full h-screen">
        {/* Sidebar */}
        <AppSidebar />

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Navbar */}
          <CoreNavbar />

          {/* Page content */}
          <main className="flex-1 overflow-auto p-8">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
