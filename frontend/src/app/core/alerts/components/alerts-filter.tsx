interface AlertsFilterProps {
  currentFilter: 'all' | 'unread'
  onChange: (filter: 'all' | 'unread') => void
}

export default function AlertsFilter({
  currentFilter,
  onChange,
}: AlertsFilterProps) {
  return (
    <div className="flex gap-2 border-b border-border">
      <button
        onClick={() => onChange('all')}
        className={`cursor-pointer px-3 py-2 text-sm font-medium transition-colors ${
          currentFilter === 'all'
            ? 'border-b-2 border-foreground text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        All alerts
      </button>
      <button
        onClick={() => onChange('unread')}
        className={`cursor-pointer px-3 py-2 text-sm font-medium transition-colors ${
          currentFilter === 'unread'
            ? 'border-b-2 border-foreground text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Unread
      </button>
    </div>
  )
}
