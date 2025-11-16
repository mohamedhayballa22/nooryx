'use client'

import { useState, useEffect } from 'react'
import AlertCard from './alert-card'
import AlertsFilter from './alerts-filter'
import AlertsHeader from './alerts-header'
import AlertsLegend from './alerts-legend'
import EmptyState from './empty-state'

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

interface Alert {
  alert_type: 'low_stock' | 'team_member_joined'
  severity: string
  title: string
  message: string | null
  alert_metadata: LowStockMetadata | TeamMemberJoinedMetadata
  id: string
  aggregation_key: string | null
  is_read: boolean
}

interface AlertsResponse {
  items: Alert[]
  total: number
}

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        setLoading(true)
        const mockResponse: AlertsResponse = {
          items: [
            {
              alert_type: 'team_member_joined',
              severity: 'info',
              title: 'Charles Oliveira joined the team',
              message: null,
              alert_metadata: {
                role: null,
                user_id: '46e1067a-cd01-4da2-b733-fca61480efb8',
                user_name: 'Charles Oliveira',
                user_email: 'charles.oliveira@nooryx.com',
              },
              id: '6e6716d8-f697-4907-86d4-7a2d6330fb80',
              aggregation_key: null,
              is_read: false,
            },
            {
              alert_type: 'low_stock',
              severity: 'critical',
              title: '2 SKUs need reordering',
              message: 'Available stock has fallen below reorder points',
              alert_metadata: {
                details: [
                  {
                    sku_code: 'HILUX-15',
                    sku_name: 'Hilux 2015',
                    available: 14,
                    reorder_point: 15,
                  },
                  {
                    sku_code: 'MACBOOK-AIR',
                    sku_name: 'Macbook Air',
                    available: 9,
                    reorder_point: 10,
                  },
                ],
                sku_codes: ['HILUX-15', 'MACBOOK-AIR'],
                check_timestamp: '2025-11-15T18:21:51.664616',
              },
              id: 'e08407a3-480a-46fc-b841-e93de21b4515',
              aggregation_key: 'low_stock_2025-11-15',
              is_read: true,
            },
          ],
          total: 2,
        }

        setAlerts(mockResponse.items)
        setError(null)
      } catch (err) {
        setError('Failed to load alerts')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchAlerts()
  }, [])

  const filteredAlerts =
    filter === 'unread' ? alerts.filter((a) => !a.is_read) : alerts

  const unreadCount = alerts.filter((a) => !a.is_read).length

  const handleMarkAllRead = async () => {
    setAlerts(alerts.map((alert) => ({ ...alert, is_read: true })))
    // TODO: Call API endpoint to mark all as read
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <AlertsHeader unreadCount={unreadCount} onMarkAllRead={handleMarkAllRead} />

      <div className="mb-6 flex items-center justify-between">
        <AlertsFilter currentFilter={filter} onChange={setFilter} />
        <AlertsLegend />
      </div>

      <div className="space-y-3 mt-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-red-600 dark:text-red-400">
            {error}
          </div>
        ) : filteredAlerts.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          filteredAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))
        )}
      </div>
    </div>
  )
}
