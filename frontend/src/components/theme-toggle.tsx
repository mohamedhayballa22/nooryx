"use client"

import { useId } from "react"
import { MoonIcon, SunIcon, MonitorIcon } from "lucide-react"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useThemeToggle } from "@/hooks/use-theme"

export default function ThemeToggle() {
  const id = useId()
  const { current, handleThemeChange, mounted } = useThemeToggle()

  if (!mounted) return null // avoid hydration mismatch

  return (
    <div>
      <ToggleGroup
        type="single"
        value={current}
        onValueChange={(val) => val && handleThemeChange(val as "light" | "dark" | "system")}
        className="inline-flex items-center gap-1 rounded-md border bg-muted p-1 text-sm h-10"
      >
        <ToggleGroupItem
          value="system"
          aria-label="System theme"
          className="flex items-center justify-center rounded-sm p-2 data-[state=on]:bg-background h-8"
        >
          <MonitorIcon size={16} />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="light"
          aria-label="Light theme"
          className="flex items-center justify-center rounded-sm p-2 data-[state=on]:bg-background h-8"
        >
          <SunIcon size={16} />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="dark"
          aria-label="Dark theme"
          className="flex items-center justify-center rounded-sm p-2 data-[state=on]:bg-background h-8"
        >
          <MoonIcon size={16} />
        </ToggleGroupItem>
      </ToggleGroup>
      <Label htmlFor={id} className="sr-only">
        Toggle theme
      </Label>
    </div>
  )
}
