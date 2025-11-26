'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useFormatting } from '@/hooks/use-formatting'
import { useMarkAlertAsRead } from '@/hooks/use-alerts'
import type { AlertResponse } from '@/lib/api/alerts'

interface LowStockMetadata {
  details: Array<{
    sku_code: string
    sku_name: string
    available: number
    reorder_point: number
  }>
  sku_codes: string[]
  check_timestamp: string
}

interface TeamMemberJoinedMetadata {
  role: string | null
  user_id: string
  user_name: string
  user_email: string
}

interface AlertCardProps {
  alert: AlertResponse
}

export default function AlertCard({ alert }: AlertCardProps) {
  const [expanded, setExpanded] = useState(false)
  const { formatDate } = useFormatting()
  const markAsReadMutation = useMarkAlertAsRead()

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'warning':
        return {
          dot: 'bg-amber-500',
          badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/50 dark:border-amber-500/30',
        }
      case 'critical':
        return {
          dot: 'bg-red-500',
          badge: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-200/50 dark:border-red-500/30',
        }
      default:
        return {
          dot: 'bg-blue-500',
          badge: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200/50 dark:border-blue-500/30',
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

  const handleMarkAsRead = async () => {
    await markAsReadMutation.mutateAsync(alert.id)
  }

  const isLowStock = alert.alert_type === 'low_stock'
  const isTeamMemberJoined = alert.alert_type === 'team_member_joined'
  const severityStyles = getSeverityStyles(alert.severity)

  const lowStockMetadata = alert.alert_metadata as LowStockMetadata | undefined
  const teamMemberMetadata = alert.alert_metadata as TeamMemberJoinedMetadata | undefined

  return (
    <div
      className={`rounded-lg border transition-all ${
        alert.is_read
          ? 'border-border bg-card opacity-60'
          : 'border-border bg-card shadow-sm'
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
            {/* Unread indicator - bold vertical bar */}
            {!alert.is_read && (
              <div className={`h-5 w-1 rounded-full flex-shrink-0 ${severityStyles.dot}`} />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className={`font-medium text-sm ${!alert.is_read ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {alert.title}
                </h3>
                {/* Severity badge */}
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${severityStyles.badge}`}>
                  {alert.severity}
                </span>
              </div>
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
          {isLowStock && lowStockMetadata && (
            <>
              <div className="space-y-2">
                {(lowStockMetadata.details || []).slice().reverse().map((detail) => (
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
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  {formatTime(lowStockMetadata.check_timestamp)}
                </p>
                {!alert.is_read && (
                  <button
                    onClick={handleMarkAsRead}
                    disabled={markAsReadMutation.isPending}
                    className="cursor-pointer text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                  >
                    {markAsReadMutation.isPending ? 'Marking...' : 'Mark as read'}
                  </button>
                )}
              </div>
            </>
          )}

          {isTeamMemberJoined && teamMemberMetadata && (
            <>
              <div className="rounded-md bg-muted/50 p-3 space-y-1.5 text-sm">
                <p className="font-medium text-foreground text-sm">
                  {teamMemberMetadata.user_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {teamMemberMetadata.user_email}
                </p>
                {teamMemberMetadata.role && (
                  <p className="text-xs text-muted-foreground">
                    {teamMemberMetadata.role}
                  </p>
                )}
              </div>

              {!alert.is_read && (
                <div className="flex items-center justify-end pt-1">
                  <button 
                    onClick={handleMarkAsRead}
                    disabled={markAsReadMutation.isPending}
                    className="cursor-pointer text-xs font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                  >
                    {markAsReadMutation.isPending ? 'Marking...' : 'Mark as read'}
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
