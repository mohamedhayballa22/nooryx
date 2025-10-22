"use client";

import { useAuth } from "@/lib/auth";
import { AuthLoading } from "@/components/auth-loading";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LandingPage() {
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
    <div className="h-200 pt-10">
        <h1>Hey, This is the landing page (you aren't logged in)</h1>
    </div>
  );
}
