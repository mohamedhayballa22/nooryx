'use client'

interface EmptyStateProps {
  filter: 'all' | 'unread'
}

export default function EmptyState({ filter }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      {/* Icon */}
      <div className="mb-6 rounded-full bg-secondary p-4">
        <svg
          className="h-8 w-8 text-muted-foreground"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>

      {/* Heading */}
      <h3 className="mb-2 text-lg font-semibold text-foreground">
        {filter === 'unread' ? 'All caught up' : 'No alerts'}
      </h3>

      {/* Description */}
      <p className="text-center text-sm text-muted-foreground max-w-xs">
        {filter === 'unread'
          ? "You've reviewed all your alerts. Check back soon for updates."
          : 'Your inventory is running smoothly. Alerts will appear here when action is needed.'}
      </p>
    </div>
  )
}
