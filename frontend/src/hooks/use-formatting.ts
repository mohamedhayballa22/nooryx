import { useUserSettings } from "./use-user-settings"

export function useFormatting() {
  const { settings } = useUserSettings()
  
  const locale = settings?.locale === "system" || !settings?.locale 
    ? navigator.language
    : settings.locale

  const getDateFormatConfig = () => {
    switch (settings?.date_format) {
      case 'dd/mm/yyyy_24h':
        return { 
          locale: 'en-GB',
          options: { 
            year: 'numeric' as const, month: '2-digit' as const, day: '2-digit' as const,
            hour: '2-digit' as const, minute: '2-digit' as const, hour12: false 
          }
        }
      case 'mm/dd/yyyy_12h':
        return { 
          locale: 'en-US',
          options: { 
            year: 'numeric' as const, month: '2-digit' as const, day: '2-digit' as const,
            hour: '2-digit' as const, minute: '2-digit' as const, hour12: true 
          }
        }
      case 'yyyy-mm-dd_24h':
        return {
          locale: 'sv-SE',
          options: { 
            year: 'numeric' as const, month: '2-digit' as const, day: '2-digit' as const,
            hour: '2-digit' as const, minute: '2-digit' as const, hour12: false 
          }
        }
      case 'long_mdy_24h':
        return {
          locale: 'en-US',
          options: {
            year: 'numeric' as const, month: 'short' as const, day: '2-digit' as const,
            hour: '2-digit' as const, minute: '2-digit' as const, hour12: false,
          }
        }
      case 'long_mdy_12h':
        return {
          locale: 'en-US',
          options: {
            year: 'numeric' as const, month: 'short' as const, day: '2-digit' as const,
            hour: '2-digit' as const, minute: '2-digit' as const, hour12: true,
          }
        }
      case 'long_dmy_24h':
        return {
          locale: 'en-GB',
          options: {
            year: 'numeric' as const, month: 'short' as const, day: '2-digit' as const,
            hour: '2-digit' as const, minute: '2-digit' as const, hour12: false,
          }
        }
      case 'long_dmy_12h':
        return {
          locale: 'en-GB',
          options: {
            year: 'numeric' as const, month: 'short' as const, day: '2-digit' as const,
            hour: '2-digit' as const, minute: '2-digit' as const, hour12: true,
          }
        }
      default: // 'system' or undefined
        return { 
          locale, 
          options: {
            year: 'numeric' as const, month: '2-digit' as const, day: '2-digit' as const,
            hour: '2-digit' as const, minute: '2-digit' as const
          }
        }
    }
  }

  const formatDate = (date: Date | string | number) => {
    const d = new Date(date)
    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0

    const { locale: effectiveLocale, options } = getDateFormatConfig()

    // If time is midnight, strip time fields
    if (!hasTime) {
      const { hour, minute, hour12, ...dateOnlyOptions } = options as any
      return d.toLocaleDateString(effectiveLocale, dateOnlyOptions)
    }

    return d.toLocaleString(effectiveLocale, options)
  }

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString(locale, {
      style: 'currency',
      currency: settings?.currency || 'USD',
    })
  }

  const formatQuantity = (quantity: number, maximumFractionDigits: number = 2) => {
    return quantity.toLocaleString(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits,
    })
  }

  return { locale, formatDate, formatCurrency, formatQuantity }
}
