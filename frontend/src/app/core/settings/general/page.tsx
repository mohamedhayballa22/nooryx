"use client"

import { useState } from "react"
import ThemeToggle from "@/components/theme-toggle"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Settings,
  SettingsSection,
  SettingsSubSection,
  SettingRow,
} from "@/components/app-settings"

const LOCALES = [
  { label: 'English (United States)', value: 'en-US' },
  { label: 'English (United Kingdom)', value: 'en-GB' },
  { label: 'Français (France)', value: 'fr-FR' },
  { label: 'Español (España)', value: 'es-ES' },
  { label: 'Deutsch (Deutschland)', value: 'de-DE' },
  { label: 'Português (Brazil)', value: 'pt-BR' },
]

export default function PreferencesPage() {
  const [paginationSize, setPaginationSize] = useState("25")
  const [dateFormat, setDateFormat] = useState("system")
  const [locale, setLocale] = useState("en-US")

  return (
    <Settings>
      <SettingsSection>
        <SettingsSubSection title="Interface and theme">
          <SettingRow
            label="Interface theme"
            description="Select your interface theme"
            control={<ThemeToggle />}
          />
        </SettingsSubSection>

        <SettingsSubSection title="Display settings">
          <SettingRow
            label="Default pagination size"
            description="Number of items to display per page"
            control={
              <Select value={paginationSize} onValueChange={setPaginationSize}>
                <SelectTrigger className="w-auto min-w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 items</SelectItem>
                  <SelectItem value="25">25 items</SelectItem>
                  <SelectItem value="50">50 items</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <SettingRow
            label="Date format"
            description="How dates and times are displayed"
            control={
              <Select value={dateFormat} onValueChange={setDateFormat}>
                <SelectTrigger className="w-auto min-w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System Default </SelectItem>
                  <SelectItem value="dd/mm/yyyy_24h">DD/MM/YYYY, 24h</SelectItem>
                  <SelectItem value="mm/dd/yyyy_12h">MM/DD/YYYY, 12h</SelectItem>
                  <SelectItem value="long_24h">Jan 01, 2025 at 13:45 (24h)</SelectItem>
                  <SelectItem value="long_12h">Jan 01, 2025 at 1:45 PM (12h)</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <SettingRow
            label="Locale"
            description="Affects number formatting and thousand separators"
            control={
              <Select value={locale} onValueChange={setLocale}>
                <SelectTrigger className="w-auto min-w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((loc) => (
                    <SelectItem key={loc.value} value={loc.value}>
                      {loc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          />
        </SettingsSubSection>

        <SettingsSubSection title="Financial settings">
          <SettingRow
            label="Currency"
            description="Display currency for all amounts"
            control={
              <Select value="USD" disabled>
                <SelectTrigger className="w-auto min-w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <SettingRow
            label="Valuation method"
            description="Method used for cost basis calculations"
            control={
              <Select value="FIFO" disabled>
                <SelectTrigger className="w-auto min-w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIFO">FIFO</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        </SettingsSubSection>
      </SettingsSection>
    </Settings>
  )
}
