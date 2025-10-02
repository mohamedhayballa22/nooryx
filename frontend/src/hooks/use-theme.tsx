"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function useThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // When not mounted, return "system" to avoid hydration mismatch
  const current = mounted ? (theme ?? "system") : "system"

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme)
  }

  return { current, handleThemeChange, resolvedTheme, mounted }
}
