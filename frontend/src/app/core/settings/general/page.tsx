"use client"

import { useState } from "react"
import { EditPencil } from "iconoir-react"
import ThemeToggle from "@/components/theme-toggle"
import {
  Settings,
  SettingsSection,
  SettingsSubSection,
  SettingRow,
} from "@/components/app-settings"
import { Button } from "@/components/ui/button"
import { SettingsEditDialog } from "../components/settings-edit-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useUserSettings } from "@/hooks/use-user-settings"

const LOCALES = [
  { label: 'English (United States)', value: 'en-US' },
  { label: 'English (United Kingdom)', value: 'en-GB' },
  { label: 'Français (France)', value: 'fr-FR' },
  { label: 'Español (España)', value: 'es-ES' },
  { label: 'Deutsch (Deutschland)', value: 'de-DE' },
  { label: 'Português (Brazil)', value: 'pt-BR' },
]

const PAGINATION_OPTIONS = [
  { label: '10 items', value: '10' },
  { label: '25 items', value: '25' },
  { label: '50 items', value: '50' },
  { label: '100 items', value: '100' },
]

const DATE_FORMAT_OPTIONS = [
  { label: 'System Default', value: 'system' },
  { label: 'DD/MM/YYYY, 24h', value: 'dd/mm/yyyy_24h' },
  { label: 'MM/DD/YYYY, 12h', value: 'mm/dd/yyyy_12h' },
  { label: 'Jan 01, 2025 at 13:45 (24h)', value: 'long_24h' },
  { label: 'Jan 01, 2025 at 1:45 PM (12h)', value: 'long_12h' },
]

export default function PreferencesPage() {
  const { settings } = useUserSettings()
  // Dialog states
  const [editingPagination, setEditingPagination] = useState(false)
  const [editingDateFormat, setEditingDateFormat] = useState(false)
  const [editingLocale, setEditingLocale] = useState(false)

  return (
    <>
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
                <div className="flex items-center gap-2">
                  <span className="text-sm">{PAGINATION_OPTIONS.find(option => option.value === settings?.pagination?.toString())?.label}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => setEditingPagination(true)}
                  >
                    <EditPencil className="h-4 w-4" />
                  </Button>
                </div>
              }
            />
            <SettingRow
              label="Date format"
              description="How dates and times are displayed"
              control={
                <div className="flex items-center gap-2">
                  <span className="text-sm">{DATE_FORMAT_OPTIONS.find(option => option.value === settings?.date_format)?.label}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => setEditingDateFormat(true)}
                  >
                    <EditPencil className="h-4 w-4" />
                  </Button>
                </div>
              }
            />
            <SettingRow
              label="Locale"
              description="Affects number formatting and thousand separators"
              control={
                <div className="flex items-center gap-2">
                  <span className="text-sm">{LOCALES.find(option => option.value === settings?.locale)?.label}</span>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 w-8 p-0"
                    onClick={() => setEditingLocale(true)}
                  >
                    <EditPencil className="h-4 w-4" />
                  </Button>
                </div>
              }
            />
          </SettingsSubSection>

          <SettingsSubSection title="Financial settings">
            <SettingRow
              label="Currency"
              description="Display currency for all amounts"
              control={<span className="text-sm">{settings?.currency}</span>}
            />
            <SettingRow
              label="Valuation method"
              description="Method used for cost basis calculations"
              control={<span className="text-sm">{settings?.valuation_method}</span>}
            />
          </SettingsSubSection>
        </SettingsSection>
      </Settings>

      {/* Edit Dialogs */}
      <SettingsEditDialog
        open={editingPagination}
        onOpenChange={setEditingPagination}
        title="Default pagination size"
        description="Number of items to display per page"
        initialValue={settings?.pagination?.toString()}
        settingKey="pagination"
      >
        {(value, onChange) => (
          <div className="space-y-2">
            <Select value={value} onValueChange={onChange}>
              <SelectTrigger className="mt-2" id="pagination-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGINATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </SettingsEditDialog>

      <SettingsEditDialog
        open={editingDateFormat}
        onOpenChange={setEditingDateFormat}
        title="Date format"
        description="How dates and times are displayed"
        initialValue={settings?.date_format}
        settingKey="date_format"
      >
        {(value, onChange) => (
          <div className="space-y-2">
            <Select value={value} onValueChange={onChange}>
              <SelectTrigger className="mt-2" id="date-format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </SettingsEditDialog>

      <SettingsEditDialog
        open={editingLocale}
        onOpenChange={setEditingLocale}
        title="Locale"
        description="Affects number formatting and thousand separators"
        initialValue={settings?.locale}
        settingKey="locale"
      >
        {(value, onChange) => (
          <div className="space-y-2">
            <Select value={value} onValueChange={onChange}>
              <SelectTrigger className="mt-2" id="locale">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </SettingsEditDialog>
    </>
  )
}
