"use client"

import { MetricCard } from "@/components/MetricCard"
import type { InventorySnapshot } from "@/lib/api/inventory"

interface SkuSnapshotCardsProps {
  data: InventorySnapshot
}

export function SkuSnapshotCards({ data }: SkuSnapshotCardsProps) {
  const { summary, locations, location, inventory_pct } = data
  const { available, reserved, on_hand } = summary

  const hasDelta = on_hand.delta_pct !== 0
  const isIncrease = on_hand.delta_pct > 0

  const onHandDescription = hasDelta
    ? isIncrease
      ? `Up ${on_hand.delta_pct}% compared to last week`
      : `Down ${Math.abs(on_hand.delta_pct)}% compared to last week`
    : on_hand.value === 0
      ? `No units available for this SKU`
      : `No movement compared to last week`

  const onHandSubtitle = `Total units currently ${
    location ? `in ${location}` : `across all locations`
  }.`

  const availableDescription =
    available <= 0
      ? `Out of sellable stock — restock required`
      : reserved > 0 && available < reserved
      ? `Inventory moving steadily`
      : `Good availability`

  const availableSubtitle = `Sellable stock not yet reserved.`

  const reservedDescription =
    reserved === 0
      ? `No active reservations`
      : reserved <= available / 2
      ? `Moderate activity`
      : reserved > on_hand.value
      ? `Orders exceeding supply`
      : `Steady demand`

  const reservedSubtitle = `Units committed to orders but not yet shipped.`

  let locationCardTitle = "Locations"
  let locationCardValue: string | number = locations
  let locationsDescription = ""
  let locationsSubtitle = ""

  if (location === null) {
    locationCardTitle = "Locations"
    locationCardValue = locations
    locationsDescription =
      locations > 1
        ? `Distributed across multiple locations`
        : `Single location view`
    locationsSubtitle = `Number of storage locations where this SKU is held.`
  } else {
    locationCardTitle = "Location"
    locationCardValue = location

    if (locations > 1) {
      locationsDescription = `1 of ${locations} total locations`
      locationsSubtitle = `This location holds ${inventory_pct}% of this SKU's total inventory.`
    } else {
      locationsDescription = `Single location view`
      locationsSubtitle = `This location holds ${inventory_pct}% of this SKU's total inventory.`
    }
  }

  return (
    <section
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      role="region"
      aria-label="SKU Snapshot"
    >
      <MetricCard
        title="On Hand"
        value={on_hand.value}
        delta={hasDelta ? on_hand.delta_pct : undefined}
        description={onHandDescription}
        subtitle={onHandSubtitle}
      />
      <MetricCard
        title="Available"
        value={available}
        description={availableDescription}
        subtitle={availableSubtitle}
      />
      <MetricCard
        title="Reserved"
        value={reserved}
        description={reservedDescription}
        subtitle={reservedSubtitle}
      />
      <MetricCard
        title={locationCardTitle}
        value={locationCardValue}
        description={locationsDescription}
        subtitle={locationsSubtitle}
      />
    </section>
  )
}

SkuSnapshotCards.Skeleton = function SkuSnapshotCardsSkeleton() {
  return (
    <section
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
      role="region"
      aria-label="SKU Snapshot Loading"
    >
      <MetricCard.Skeleton/>
      <MetricCard.Skeleton/>
      <MetricCard.Skeleton/>
      <MetricCard.Skeleton/>
    </section>
  )
}
