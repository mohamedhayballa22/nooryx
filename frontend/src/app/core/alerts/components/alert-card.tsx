'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useFormatting } from '@/hooks/use-formatting'

interface Alert {
  alert_type: 'low_stock' | 'team_member_joined'
  severity: string
  title: string
  message: string | null
  alert_metadata: any
  id: string
  is_read: boolean
}

interface AlertCardProps {
  alert: Alert
}

export default function AlertCard({ alert }: AlertCardProps) {
  const [expanded, setExpanded] = useState(false)
  const { formatDate } = useFormatting();

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'warning':
        return {
          dot: 'bg-amber-500',
          bg: 'bg-amber-500/5 dark:bg-amber-500/10',
          border: 'border-amber-200/50 dark:border-amber-500/20',
        }
      case 'critical':
        return {
          dot: 'bg-red-500',
          bg: 'bg-red-500/5 dark:bg-red-500/10',
          border: 'border-red-200/50 dark:border-red-500/20',
        }
      default:
        return {
          dot: 'bg-gray-400 dark:bg-gray-500',
          bg: 'bg-transparent',
          border: 'border-border',
        }
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    if (isNaN(date.getTime())) {
      return 'N/A'
    }
    return formatDate(date)
  }

  const isLowStock = alert.alert_type === 'low_stock'
  const isTeamMemberJoined = alert.alert_type === 'team_member_joined'
  const severityStyles = getSeverityStyles(alert.severity)

  return (
    <div
      className={`rounded-lg border transition-all ${
        alert.is_read
          ? 'border-border bg-card'
          : `${severityStyles.border} ${severityStyles.bg}`
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer w-full px-4 py-3.5 text-left hover:bg-muted/30 transition-colors rounded-lg"
        aria-expanded={expanded}
        aria-label={`Toggle alert details: ${alert.title}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Severity indicator */}
            <div className={`h-2 w-2 rounded-full flex-shrink-0 mt-1 ${severityStyles.dot}`} />

            <div className="flex-1 min-w-0">
              <h3 className={`font-medium text-sm ${!alert.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                {alert.title}
              </h3>
              {alert.message && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                  {alert.message}
                </p>
              )}
            </div>
          </div>

          <ChevronDown
            size={16}
            className={`text-muted-foreground transition-transform flex-shrink-0 mt-0.5 ${
              expanded ? 'rotate-180' : ''
            }`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-3">
          {isLowStock && (
            <>
              <div className="space-y-2">
                {(alert.alert_metadata?.details || []).map(
                  (detail: {
                    sku_code: string
                    sku_name: string
                    available: number
                    reorder_point: number
                  }) => (
                    <div
                      key={detail.sku_code}
                      className="rounded-md bg-muted/50 p-3 flex items-center justify-between text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground text-sm">
                          {detail.sku_name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {detail.sku_code}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-medium text-foreground text-sm">
                          Available: {detail.available}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Reorder Point: {detail.reorder_point}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  {formatTime(alert.alert_metadata.check_timestamp)}
                </p>
                {!alert.is_read && (
                  <button
                    onClick={() => {/* TODO: implement mark as read */}}
                    className="cursor-pointer xt-xs font-medium text-foreground/60 hover:text-foreground transition-colors"
                  >
                    Mark as read
                  </button>
                )}
              </div>
            </>
          )}

          {isTeamMemberJoined && (
            <>
              <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-sm">
                <p className="font-medium text-foreground text-sm">
                  {alert.alert_metadata.user_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {alert.alert_metadata.user_email}
                </p>
                {alert.alert_metadata.role && (
                  <p className="text-xs text-muted-foreground">
                    {alert.alert_metadata.role}
                  </p>
                )}
              </div>

              {!alert.is_read && (
                <div className="flex items-center justify-end pt-1">
                  <button 
                    onClick={() => {/* TODO: implement mark as read */}}
                    className="cursor-pointer text-xs font-medium text-foreground/60 hover:text-foreground transition-colors"
                  >
                    Mark as read
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
