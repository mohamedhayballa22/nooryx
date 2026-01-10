interface AlertsHeaderProps {
  unreadCount: number
  onMarkAllRead: () => void
}

export default function AlertsHeader({
  unreadCount,
  onMarkAllRead,
}: AlertsHeaderProps) {
  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-4 sm:gap-0">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Alerts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stay on top of your inventory
        </p>
      </div>

      <div className="flex items-center gap-3">
        {unreadCount > 0 && (
          <>
            <button
              onClick={onMarkAllRead}
              className="cursor-pointer text-xs font-medium text-foreground/65 hover:text-foreground transition-colors"
            >
              Mark all as read
            </button>

            <div className="inline-flex items-center gap-2 rounded-full bg-foreground/10 px-3 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground" />
              <span className="text-xs font-medium text-foreground">
                {unreadCount} unread
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
