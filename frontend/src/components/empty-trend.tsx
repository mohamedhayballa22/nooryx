"use client";

import { UnplugIcon } from "lucide-react";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";

export function EmptyTrend() {
  return (
    <Empty className="h-full flex flex-col items-center justify-center text-center px-6 -mt-4">
      <EmptyHeader className="max-w-2xl mx-auto">
        <EmptyMedia variant="icon" className="size-16">
          <UnplugIcon className="size-10" strokeWidth={1.5} />
        </EmptyMedia>
        <EmptyTitle className="text-2xl md:text-3xl font-bold tracking-tight">
          No trend to show (yet)
        </EmptyTitle>
        <EmptyDescription className="text-base md:text-lg text-muted-foreground max-w-md mx-auto">
          Once there&apos;s a few more changes in quantity, we&apos;ll plot it here.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
