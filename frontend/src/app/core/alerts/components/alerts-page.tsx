'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AlertCard from './alert-card'
import AlertsFilter from './alerts-filter'
import AlertsHeader from './alerts-header'
import AlertsLegend from './alerts-legend'
import EmptyState from './empty-state'
import { PaginationControls } from '@/components/app-pagination'
import { useAlerts, useMarkAllAlertsAsRead } from '@/hooks/use-alerts'
import { useUserSettings } from '@/hooks/use-user-settings'

function parseUrlParams(searchParams: URLSearchParams, defaultPageSize: number) {
  const page = parseInt(searchParams.get("page") || "1", 10) - 1;
  const size = parseInt(searchParams.get("size") || String(defaultPageSize), 10);
  const filter = (searchParams.get("filter") || "all") as "all" | "unread";
  
  return {
    page: Math.max(0, page),
    size,
    filter,
  };
}

export default function AlertsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { settings } = useUserSettings();
  
  // Get default page size from settings, fallback to 10
  const defaultPageSize = settings?.pagination || 10;
  
  // Initialize state from URL (URL takes precedence over settings)
  const urlParams = parseUrlParams(searchParams, defaultPageSize);
  
  const [pageIndex, setPageIndex] = useState(urlParams.page);
  const [pageSize, setPageSize] = useState(urlParams.size);
  const [filter, setFilter] = useState<'all' | 'unread'>(urlParams.filter);
  
  // Sync URL with state
  useEffect(() => {
    const params = new URLSearchParams();
    
    if (pageIndex !== 0) {
      params.set("page", String(pageIndex + 1));
    }
    
    if (pageSize !== defaultPageSize) {
      params.set("size", String(pageSize));
    }
    
    if (filter !== "all") {
      params.set("filter", filter);
    }
    
    // Update URL - if no params, just use the base path
    const queryString = params.toString();
    router.replace(queryString ? `?${queryString}` : window.location.pathname, { scroll: false });
  }, [pageIndex, pageSize, filter, router, defaultPageSize]);

  const { 
    items: alerts, 
    totalItems,
    totalPages,
    isLoading, 
    error 
  } = useAlerts({
    page: pageIndex + 1,
    size: pageSize,
    read: filter === 'unread' ? 'unread' : undefined,
  });
  
  const markAllAsReadMutation = useMarkAllAlertsAsRead();

  const unreadCount = alerts.filter((a) => !a.is_read).length;

  // Reset to page 0 when filter changes
  useEffect(() => {
    if (pageIndex !== 0) {
      setPageIndex(0);
    }
  }, [filter]);

  const handleMarkAllRead = async () => {
    await markAllAsReadMutation.mutateAsync();
  };

  const handleFilterChange = (newFilter: 'all' | 'unread') => {
    setFilter(newFilter);
  };

  // Show pagination only when total items exceed page size
  const showPagination = totalItems > pageSize;

  return (
    <div className="mx-auto max-w-2xl py-6">
      <AlertsHeader unreadCount={unreadCount} onMarkAllRead={handleMarkAllRead} />

      <div className="mb-6 flex items-center justify-between">
        <AlertsFilter currentFilter={filter} onChange={handleFilterChange} />
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

      {showPagination && !isLoading && !error && (
        <div className="mt-6">
          <PaginationControls
            pageIndex={pageIndex}
            pageSize={pageSize}
            totalPages={totalPages}
            totalItems={totalItems}
            loading={isLoading}
            onPageChange={setPageIndex}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPageIndex(0);
            }}
          />
        </div>
      )}
    </div>
  );
}
