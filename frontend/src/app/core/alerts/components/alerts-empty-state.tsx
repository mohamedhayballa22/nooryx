'use client'

import { CheckCircle2Icon } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

interface AlertsEmptyStateProps {
  filter: 'all' | 'unread'
}

export default function AlertsEmptyState({ filter }: AlertsEmptyStateProps) {
  return (
    <Empty className="min-h-[400px] flex flex-col items-center justify-center text-center px-6">
      <EmptyHeader className="max-w-2xl mx-auto">
        <EmptyMedia variant="icon" className="size-16">
          <CheckCircle2Icon className="size-10" strokeWidth={1.5} />
        </EmptyMedia>
        <EmptyTitle className="text-3xl md:text-4xl font-bold tracking-tight">
          {filter === 'unread' ? 'All caught up' : 'No alerts'}
        </EmptyTitle>
        <EmptyDescription className="text-base md:text-lg text-muted-foreground max-w-md mx-auto">
          {filter === 'unread'
            ? "You've reviewed all your alerts. Check back soon for updates."
            : 'Your inventory is running smoothly. Alerts will appear here when action is needed.'}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
