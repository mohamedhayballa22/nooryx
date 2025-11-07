"use client"

import { MetricCard } from "@/components/MetricCard"
import { DashboardMetricsData } from "@/lib/api/dashboard"

interface DashboardMetricsProps {
  data: DashboardMetricsData
}

export function DashboardMetrics({ data }: DashboardMetricsProps) {
  const { total_available, total_on_hand, stockouts, low_stock, location } = data

  const hasDelta = total_on_hand.delta_pct !== 0
  const isIncrease = total_on_hand.delta_pct > 0

  const onHandDescription = hasDelta
    ? isIncrease
      ? `Up ${total_on_hand.delta_pct}% compared to last week`
      : `Down ${Math.abs(total_on_hand.delta_pct)}% compared to last week`
    : total_on_hand.value === 0
      ? `No units on hand.`
      : `No change compared to last week`

  const onHandSubtitle = location
    ? `All stock currently held in ${location}.`
    : `All stock across all active locations.`

  // Helper for pluralization
  const pluralizeSKU = (count: number) => (count === 1 ? "SKU" : "SKUs")

  return (
    <section
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      role="region"
      aria-label="Dashboard Metrics"
    >
      <MetricCard
        title="Total Units On Hand"
        value={total_on_hand.value}
        delta={hasDelta ? total_on_hand.delta_pct : undefined}
        description={
          total_on_hand.value > 0
            ? onHandDescription
            : "No units on hand"
        }
        subtitle={onHandSubtitle}
      />
      
      <MetricCard
        title="Total Units Available"
        value={total_available}
        description={
          total_available > 0
            ? "Sellable units currently available"
            : "No sellable stock available"
        }
        subtitle="Includes all non-reserved stock"
      />

      <MetricCard
        title="Stockouts"
        value={stockouts}
        description={
          stockouts > 0
            ? `${stockouts} ${pluralizeSKU(stockouts)} ${stockouts === 1 ? "is" : "are"} at zero quantity.`
            : "All SKUs are in stock"
        }
        subtitle="Items requiring immediate restock"
      />

      <MetricCard
        title="Low Stock Items"
        value={low_stock}
        description={
          low_stock > 0
            ? `${low_stock} ${pluralizeSKU(low_stock)} ${low_stock === 1 ? "is" : "are"} running low.`
            : "All SKUs are above the reorder threshold"
        }
        subtitle="SKUs below minimum stock levels"
      />
    </section>
  )
}

DashboardMetrics.Skeleton = function DashboardMetricsSkeleton() {
  return (
    <section
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      aria-label="Dashboard Metrics Loading"
    >
      <MetricCard.Skeleton />
      <MetricCard.Skeleton />
      <MetricCard.Skeleton />
      <MetricCard.Skeleton />
    </section>
  )
}
