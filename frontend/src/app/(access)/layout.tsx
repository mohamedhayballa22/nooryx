"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch when reading theme
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const isDark = (theme === "system" ? resolvedTheme : theme) === "dark";

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      {/* Left: Form content */}
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-start">
          <Link
            href="/"
            className="group flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            Home
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">{children}</div>
        </div>
      </div>

      {/* Right: Theme-aware preview image */}
      <div className="bg-muted relative hidden lg:block overflow-hidden">
        <Image
          src={
            isDark
              ? "/ui/nooryx-login-preview-dark.avif"
              : "/ui/nooryx-login-preview-light.avif"
          }
          alt="Inventory management platform UI dashboard"
          fill
          sizes="50vw"
          draggable={false}
          className="object-cover object-left"
          priority={false}
        />
      </div>
    </div>
  );
}
