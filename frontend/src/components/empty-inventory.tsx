"use client";

import { useState } from "react";
import { PackageOpenIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { ReceiveForm } from "./forms/receive-form";

export function EmptyInventory() {
  const [isReceiveFormOpen, setIsReceiveFormOpen] = useState(false);

  return (
    <>
      <Empty className="h-[calc(100vh-8rem)] flex flex-col items-center justify-center text-center px-6 -mt-8">
        <EmptyHeader className="2 max-w-2xl mx-auto">
          <EmptyMedia variant="icon" className="size-16">
            <PackageOpenIcon className="size-10" strokeWidth={1.5} />
          </EmptyMedia>
          <EmptyTitle className="text-3xl md:text-4xl font-bold tracking-tight">
            Quiet warehouse, isn't it?
          </EmptyTitle>
          <EmptyDescription className="text-base md:text-lg text-muted-foreground max-w-md mx-auto">
            No boxes, no bins, just potential. Add some items and let's fill these shelves.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <Button variant="outline" className="cursor-pointer rounded-sm" onClick={() => setIsReceiveFormOpen(true)}>
            Receive Stock
          </Button>
        </EmptyContent>
      </Empty>

      <ReceiveForm open={isReceiveFormOpen} onOpenChange={setIsReceiveFormOpen} />
    </>
  );
}
