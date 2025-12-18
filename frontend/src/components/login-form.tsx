"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useState, FormEvent } from "react";
import { authApi } from "@/lib/api/auth";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, AlertTriangle } from "lucide-react";

interface ErrorState {
  title: string;
  description: string;
  type: "error" | "warning";
  retryAfter?: number;
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorState, setErrorState] = useState<ErrorState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { setUser, checkAuth } = useAuth();
  const router = useRouter();

  const variantStyles =
      errorState?.type === "warning"
      ? "bg-muted border-border text-foreground"
      : "bg-destructive/10 border-destructive/20 text-destructive";

  const parseError = (err: any): ErrorState => {
    // Handle rate limiting (429)
    if (err?.status === 429) {
      const retryAfter = err?.response?.data?.retry_after || 60;
      return {
        title: "Too Many Attempts",
        description: `Please wait ${retryAfter} seconds before trying again.`,
        type: "warning",
        retryAfter,
      };
    }

    // Get error detail from response
    const detail = err?.response?.data?.detail || err.message || "";
    const statusCode = err?.response?.status;

    // Handle fastapi-users error codes
    if (detail === "LOGIN_BAD_CREDENTIALS") {
      return {
        title: "Invalid Credentials",
        description: "The email or password you entered is incorrect. Please try again.",
        type: "error",
      };
    }

    // Handle network errors
    if (!err?.response) {
      return {
        title: "Connection Error",
        description: "Unable to reach the server. Please check your internet connection and try again.",
        type: "error",
      };
    }

    // Handle server errors (5xx)
    if (statusCode >= 500) {
      return {
        title: "Server Error",
        description: "Something went wrong on our end. Please try again in a moment.",
        type: "error",
      };
    }

    // Generic error fallback
    return {
      title: "Login Failed",
      description: "We couldn't log you in right now. Please try again.",
      type: "error",
    };
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorState(null);
    setIsLoading(true);

    let success = false;
    try {
      // Login
      await authApi.login({
        username: email,
        password,
      });

      // Acquire refresh token
      await authApi.issueRefresh();

      // Get user data and update context
      await checkAuth();

      success = true;
      router.push("/core/dashboard");
    } catch (err: any) {
      const error = parseError(err);
      setErrorState(error);
    } finally {
      if (!success) setIsLoading(false);
    }
  };

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email below to login to your account
          </p>
        </div>

        {errorState && (
          <div
            className={cn(
              "rounded-lg border p-4 animate-in fade-in slide-in-from-top-2 duration-300",
              variantStyles
            )}
          >
            <div className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                {errorState.type === "warning" ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">{errorState.title}</p>
                <p className="text-sm opacity-90">{errorState.description}</p>
              </div>
            </div>
          </div>
        )}

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
          />
        </Field>

        <Field>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
        </Field>

        <Field>
          <Button
            type="submit"
            className="cursor-pointer"
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : "Login"}
          </Button>
        </Field>

        <Field>
          <FieldDescription className="text-center">
            Don&apos;t have an account?{" "}
            <Link href="/waitlist" className="underline underline-offset-4">
              Request early access
            </Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
