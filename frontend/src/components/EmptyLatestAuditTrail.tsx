"use client";

import { ClipboardClock } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

export function EmptyLatestAuditTrail() {
  return (
    <Empty className="h-full flex flex-col items-center justify-center text-center px-6">
      <EmptyHeader className="max-w-2xl mx-auto">
        <EmptyMedia variant="icon" className="size-16">
          <ClipboardClock className="size-10" strokeWidth={1.5} />
        </EmptyMedia>
        <EmptyTitle className="text-3xl md:text-4xl font-bold tracking-tight">
          All quiet for now
        </EmptyTitle>
        <EmptyDescription className="text-base md:text-lg text-muted-foreground max-w-md mx-auto">
          Latest movement data will display here once available.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
