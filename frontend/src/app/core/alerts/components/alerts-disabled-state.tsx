"use client";

import { BellOffIcon, SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";

export default function AlertsDisabledState() {
  return (
    <Empty className="h-[calc(100vh-8rem)] flex flex-col items-center justify-center text-center px-6 -mt-8">
      <EmptyHeader className="max-w-2xl mx-auto">
        <EmptyMedia variant="icon" className="size-16">
          <BellOffIcon className="size-10" strokeWidth={1.5} />
        </EmptyMedia>

        <EmptyTitle className="text-3xl md:text-4xl font-bold tracking-tight">
          It’s a little quiet here
        </EmptyTitle>

        <EmptyDescription className="text-base md:text-lg text-muted-foreground max-w-md mx-auto">
          Alerts are turned off, so you won’t hear about low stock or important
          updates. Enable alerts to stay in the loop.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <div className="flex justify-center">
          <Button
            asChild
            variant="outline"
            className="rounded-sm w-full md:w-auto"
          >
            <Link href="/core/settings/operations">
              <SettingsIcon className="mr-1 size-4" />
              Go to Settings
            </Link>
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
