"use client"

import { MetricCard } from "@/components/MetricCard"

interface DashboardMetricsData {
  total_available: number
  total_on_hand: {
    value: number;
    delta_pct: number;
  };
  stockouts: number
  low_stock: number
  location: string | null
}

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
      : `No movement compared to last week`

  const onHandSubtitle = location
    ? `All stock currently held in ${location}.`
    : `All stock across all active locations.`

  return (
    <section
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      role="region"
      aria-label="Dashboard Metrics"
    >
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
        title="Total Units On Hand"
        value={total_on_hand.value}
        delta={hasDelta ? total_on_hand.delta_pct : undefined}
        description={
          total_on_hand.value > 0
            ? onHandDescription
            : "No inventory on hand"
        }
        subtitle={onHandSubtitle}
      />

      <MetricCard
        title="Stockouts"
        value={stockouts}
        description={
          stockouts > 0
            ? `${stockouts} SKUs currently at zero quantity.`
            : "No SKUs are fully out of stock"
        }
        subtitle="Critical items requiring immediate restock"
      />

      <MetricCard
        title="Low Stock Items"
        value={low_stock}
        description={
          low_stock > 0
            ? `${low_stock} SKUs are below reorder threshold.`
            : "All SKUs are above reorder threshold"
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
