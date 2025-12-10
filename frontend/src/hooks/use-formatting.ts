import { useUserSettings } from "./use-user-settings"

export function useFormatting() {
  const { settings } = useUserSettings()
  
  const locale = settings?.locale === "system" || !settings?.locale 
    ? (typeof navigator !== 'undefined' ? navigator.language : 'en-US')
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

  const formatDate = (date: Date | string | number, customOptions?: Intl.DateTimeFormatOptions) => {
    const d = new Date(date)
    const { locale: effectiveLocale, options } = getDateFormatConfig()

    // Priority: If custom options provided, use User's Locale + Custom Options
    if (customOptions) {
      return d.toLocaleDateString(effectiveLocale, customOptions)
    }

    // Fallback: Default logic (checking for midnight to strip time)
    const hasTime = d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0
    if (!hasTime) {
      const { hour, minute, hour12, ...dateOnlyOptions } = options as any
      return d.toLocaleDateString(effectiveLocale, dateOnlyOptions)
    }

    let formatted = d.toLocaleString(effectiveLocale, options)
    
    if (options.hour12) {
      formatted = formatted.replace(/\s?(am|pm)\b/gi, (match) => match.toUpperCase())
    }
    
    return formatted
  }

  const formatTime = (date: Date | string | number) => {
    const d = new Date(date)
    const { locale: effectiveLocale, options } = getDateFormatConfig()
    
    const { hour, minute, hour12 } = options as any
    
    let formatted = d.toLocaleTimeString(effectiveLocale, {
      hour,
      minute,
      hour12
    })
    
    if (hour12) {
      formatted = formatted.replace(/\s?(am|pm)\b/gi, (match) => match.toUpperCase())
    }
    
    return formatted
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

  return { locale, formatDate, formatTime, formatCurrency, formatQuantity }
}
