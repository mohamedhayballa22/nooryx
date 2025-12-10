"use client";

import { ClipboardClock } from "lucide-react";
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
import { useState } from "react";

export function EmptyAuditTrail() {
  const [isReceiveFormOpen, setIsReceiveFormOpen] = useState(false);
  
  return (
    <>
    <Empty className="h-[calc(100vh-8rem)] flex flex-col items-center justify-center text-center px-6 -mt-8">
      <EmptyHeader className="2 max-w-2xl mx-auto">
        <EmptyMedia variant="icon" className="size-16">
          <ClipboardClock className="size-10" strokeWidth={1.5} />
        </EmptyMedia>
        <EmptyTitle className="text-3xl md:text-4xl font-bold tracking-tight">
          Your history starts here
        </EmptyTitle>
        <EmptyDescription className="text-base md:text-lg text-muted-foreground max-w-md mx-auto">
          Nothing’s been added, moved, or tweaked yet. Once activity starts, every move will be logged right here.
        </EmptyDescription>
      </EmptyHeader>

      <EmptyContent>
        <Button 
          variant="outline"
          className="cursor-pointer rounded-sm"
          onClick={() => setIsReceiveFormOpen(true)}
        >
          Receive Stock
        </Button>
      </EmptyContent>
    </Empty>
    
    <ReceiveForm
      open={isReceiveFormOpen}
      onOpenChange={setIsReceiveFormOpen} 
      invalidateQueries={["transactions", "inventory", "trend", "valuation", "search", "skus"]}
    />
    </>
  );
}
