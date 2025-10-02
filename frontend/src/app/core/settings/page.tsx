"use client"

import { useState } from "react"
import ThemeToggle from "@/components/theme-toggle"
import { Switch } from "@/components/ui/switch"
import {
  Settings,
  SettingsSection,
  SettingsSubSection,
  SettingRow,
} from "@/components/app-settings"

export default function PreferencesPage() {
  const [reduceMotion, setReduceMotion] = useState(false)

  return (
    <Settings>
      <SettingsSection title="Preferences">
        <SettingsSubSection title="Interface and theme">
          <SettingRow
            label="Interface theme"
            description="Select your interface theme"
            control={<ThemeToggle />}
          />
          <SettingRow
            label="Reduce motion"
            description="Minimize animations and transitions for accessibility"
            control={
              <Switch
                checked={reduceMotion}
                onCheckedChange={setReduceMotion}
              />
            }
          />
        </SettingsSubSection>
      </SettingsSection>
    </Settings>
  )
}
