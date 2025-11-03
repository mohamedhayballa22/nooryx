"use client"

import { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"

// ─── Row ──────────────────────────────────────────────
interface SettingRowProps {
  label: string
  description?: string
  control: ReactNode
  isFirst?: boolean
  isLast?: boolean
}

export function SettingRow({
  label,
  description,
  control,
  isFirst,
  isLast,
}: SettingRowProps) {
  // When it's the only row (both first and last), use no padding
  const paddingClass = 
    isFirst && isLast 
      ? "py-0" 
      : isFirst 
      ? "pt-0 pb-3" 
      : isLast 
      ? "pt-3 pb-0" 
      : "py-3"

  return (
    <div
      className={`flex items-center justify-between ${paddingClass}`}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {description && (
          <span className="text-sm text-muted-foreground">{description}</span>
        )}
      </div>
      {control}
    </div>
  )
}

// ─── Sub-section (h2) ─────────────────────────────────
interface SettingsSubSectionProps {
  title: string
  action?: ReactNode
  children: ReactNode
}

export function SettingsSubSection({
  title,
  action,
  children,
}: SettingsSubSectionProps) {
  const rows = Array.isArray(children) ? children : [children]

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}</h3>
        {action && <div>{action}</div>}
      </div>
      <Card className="rounded-md shadow-xs border bg-muted/30 py-0">
        <CardContent className="p-4 divide-y divide-border">
          {rows.map((child, i) => {
            if (child && typeof child === "object" && "type" in child) {
              // Check if it's a SettingRow component (or any custom component)
              // by checking if type is a function (not a string like "div")
              if (typeof child.type === "function") {
                return (
                  <child.type
                    key={i}
                    {...child.props}
                    isFirst={i === 0}
                    isLast={i === rows.length - 1}
                  />
                )
              }
            }
            return <div key={i}>{child}</div>
          })}
        </CardContent>
      </Card>
    </section>
  )
}

// ─── Section (h1) ─────────────────────────────────────
interface SettingsSectionProps {
  title?: string
  children: ReactNode
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="max-w-3xl space-y-6">
      {title && <h2 className="text-3xl font-bold tracking-tight">{title}</h2>}
      <div className="space-y-6">{children}</div>
    </div>
  )
}

// ─── Shell (multiple top-level sections) ──────────────
interface SettingsProps {
  children: ReactNode
}

export function Settings({ children }: SettingsProps) {
  return <div className="max-w-5xl space-y-10">{children}</div>
}
