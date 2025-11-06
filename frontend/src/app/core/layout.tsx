"use client";

import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { CoreNavbar } from "@/components/core-navbar";
import { useAuth } from "@/lib/auth";
import { AuthLoading } from "@/components/auth-loading";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { useTheme } from "next-themes";
import { useUserSettings } from "@/hooks/use-user-settings";
import { useUserAccount } from "./settings/account/hooks/use-account"

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const { theme } = useTheme();
  
  // Prefetch settings and account info as soon as the authenticated layout mounts
  useUserSettings()
  useUserAccount()

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

      <Toaster 
        position="bottom-right" 
        theme={theme as "light" | "dark" | "system"}
      />
    </SidebarProvider>
  );
}
