'use client'

import { useState } from 'react'
import AlertCard from './alert-card'
import AlertsFilter from './alerts-filter'
import AlertsHeader from './alerts-header'
import AlertsLegend from './alerts-legend'
import EmptyState from './empty-state'
import { useAlerts, useMarkAllAlertsAsRead } from '@/hooks/use-alerts'

export default function AlertsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  
  const { items: alerts, isLoading, error } = useAlerts({
    read: filter === 'unread' ? 'unread' : undefined,
  })
  
  const markAllAsReadMutation = useMarkAllAlertsAsRead()

  const unreadCount = alerts.filter((a) => !a.is_read).length

  const handleMarkAllRead = async () => {
    await markAllAsReadMutation.mutateAsync()
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <AlertsHeader unreadCount={unreadCount} onMarkAllRead={handleMarkAllRead} />

      <div className="mb-6 flex items-center justify-between">
        <AlertsFilter currentFilter={filter} onChange={setFilter} />
        <AlertsLegend />
      </div>

      <div className="space-y-3 mt-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-600 dark:text-red-400">
            Failed to load alerts
          </div>
        ) : alerts.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))
        )}
      </div>
    </div>
  )
}
