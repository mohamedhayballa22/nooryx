"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoginForm } from "@/components/login-form";
import { useAuth } from "@/lib/auth";
import { AuthLoading } from "@/components/auth-loading";

export default function LoginPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  // Redirect authenticated users
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

  return <LoginForm />;
}
