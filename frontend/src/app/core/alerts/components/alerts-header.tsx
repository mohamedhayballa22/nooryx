interface AlertsHeaderProps {
  unreadCount: number
  onMarkAllRead: () => void
}

export default function AlertsHeader({
  unreadCount,
  onMarkAllRead,
}: AlertsHeaderProps) {
  return (
    <div className="mb-8 flex items-baseline justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stay on top of your inventory
        </p>
      </div>
      <div className="flex items-center gap-3">
        {unreadCount > 0 && (
          <>
            <button
              onClick={onMarkAllRead}
              className="cursor-pointer text-xs font-medium text-foreground/60 hover:text-foreground transition-colors"
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
