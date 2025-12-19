"use client"

import { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"

// Row
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
      ? "pt-0 pb-4 sm:pb-3" 
      : isLast 
      ? "pt-4 sm:pt-3 pb-0" 
      : "py-4 sm:py-3"

  return (
    <div
      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${paddingClass}`}
    >
      <div className="flex flex-col space-y-0.5">
        <span className="text-sm font-medium leading-none">{label}</span>
        {description && (
          <span className="text-sm text-muted-foreground leading-snug">
            {description}
          </span>
        )}
      </div>
      <div className="flex items-center shrink-0">
        {control}
      </div>
    </div>
  )
}

// Sub-section (h2)
interface SettingsSubSectionProps {
  title: string
  action?: ReactNode
  children: ReactNode
  unstyled?: boolean
}

export function SettingsSubSection({
  title,
  action,
  children,
  unstyled = false,
}: SettingsSubSectionProps) {
  const rows = Array.isArray(children) ? children : [children]

  const header = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <h3 className="text-lg font-semibold">{title}</h3>
      {action && <div className="flex items-center">{action}</div>}
    </div>
  )

  if (unstyled) {
    return (
      <section className="space-y-4">
        {header}
        <div>{children}</div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      {header}
      <Card className="rounded-md shadow-sm border bg-muted/30 py-0">
        <CardContent className="p-4 divide-y divide-border">
          {rows.map((child, i) => {
            if (child && typeof child === "object" && "type" in child) {
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

// Section (h1)
interface SettingsSectionProps {
  title?: string
  children: ReactNode
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="w-full max-w-3xl space-y-6">
      {title && (
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
          {title}
        </h2>
      )}
      <div className="space-y-8 sm:space-y-6">{children}</div>
    </div>
  )
}

// Shell (multiple top-level sections)
interface SettingsProps {
  children: ReactNode
}

export function Settings({ children }: SettingsProps) {
  return <div className="w-full max-w-5xl space-y-12 sm:space-y-10">{children}</div>
}

// Skeleton version
export function SettingsSkeleton() {
  return (
    <div className="max-w-5xl space-y-10">
      <div className="max-w-3xl space-y-6">
        <div className="space-y-10 sm:space-y-6">
          {[...Array(3)].map((_, sectionIdx) => (
            <section key={sectionIdx} className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="h-7 w-32 bg-muted animate-pulse rounded" />
              </div>
              <Card className="rounded-md shadow-xs border bg-muted/30 py-0">
                <CardContent className="p-4 divide-y divide-border">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
                        i === 0 ? "pt-0 pb-4 sm:pb-3" : i === 2 ? "pt-4 sm:pt-3 pb-0" : "py-4 sm:py-3"
                      }`}
                    >
                      <div className="flex flex-col space-y-2">
                        <div className="h-4 w-28 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-48 sm:w-64 bg-muted animate-pulse rounded" />
                      </div>
                      <div className="h-6 w-12 bg-muted animate-pulse rounded" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
