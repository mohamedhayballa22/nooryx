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
          locale: 'en-GB', // Forces DD/MM/YYYY format
          options: { dateStyle: 'short' as const, timeStyle: 'short' as const, hour12: false }
        }
      case 'mm/dd/yyyy_12h':
        return { 
          locale: 'en-US', // Forces MM/DD/YYYY format
          options: { dateStyle: 'short' as const, timeStyle: 'short' as const, hour12: true }
        }
      case 'yyyy-mm-dd_24h':
        return {
          locale: 'sv-SE', // Forces YYYY-MM-DD format (Swedish locale uses ISO 8601)
          options: { dateStyle: 'short' as const, timeStyle: 'short' as const, hour12: false }
        }
      case 'long_mdy_24h':
        return {
          locale: 'en-US', // Month-Day-Year order
          options: {
            year: 'numeric' as const, month: 'short' as const, day: '2-digit' as const,
            hour: '2-digit' as const, minute: '2-digit' as const, hour12: false,
          }
        }
      case 'long_mdy_12h':
        return {
          locale: 'en-US', // Month-Day-Year order
          options: {
            year: 'numeric' as const, month: 'short' as const, day: '2-digit' as const,
            hour: '2-digit' as const, minute: '2-digit' as const, hour12: true,
          }
        }
      case 'long_dmy_24h':
        return {
          locale: 'en-GB', // Day-Month-Year order
          options: {
            year: 'numeric' as const, month: 'short' as const, day: '2-digit' as const,
            hour: '2-digit' as const, minute: '2-digit' as const, hour12: false,
          }
        }
      case 'long_dmy_12h':
        return {
          locale: 'en-GB', // Day-Month-Year order
          options: {
            year: 'numeric' as const, month: 'short' as const, day: '2-digit' as const,
            hour: '2-digit' as const, minute: '2-digit' as const, hour12: true,
          }
        }
      default: // 'system' or undefined
        return { locale, options: {} }
    }
  }

  const formatDate = (date: Date | string | number) => {
    const d = new Date(date)
    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0

    const { locale: effectiveLocale, options } = getDateFormatConfig()

    // If time is midnight, strip time fields
    if (!hasTime) {
      const { dateStyle, timeStyle, hour, minute, second, hour12, ...rest } = options as any
      return d.toLocaleDateString(effectiveLocale, rest.year ? rest : { dateStyle: 'short' })
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
