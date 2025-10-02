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
  return (
    <div
      className={[
        "flex items-center justify-between",
        isFirst ? "pt-0 pb-3" : isLast ? "pt-3 pb-0" : "py-3",
      ].join(" ")}
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
  children: ReactNode
}

export function SettingsSubSection({
  title,
  children,
}: SettingsSubSectionProps) {
  const rows = Array.isArray(children) ? children : [children]

  return (
    <section className="space-y-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <Card className="rounded-md shadow-sm border bg-muted/30 py-0">
        <CardContent className="p-4 divide-y divide-border">
          {rows.map((child, i) =>
            child && typeof child === "object" && "type" in child ? (
              <child.type
                key={i}
                {...child.props}
                isFirst={i === 0}
                isLast={i === rows.length - 1}
              />
            ) : (
              child
            )
          )}
        </CardContent>
      </Card>
    </section>
  )
}

// ─── Section (h1) ─────────────────────────────────────
interface SettingsSectionProps {
  title: string
  children: ReactNode
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
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
