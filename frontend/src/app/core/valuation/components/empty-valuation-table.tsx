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
import { useState } from "react";
import { ReceiveForm } from "@/components/forms/receive-form";

export function EmptyValuationTable() {
  const [isReceiveFormOpen, setIsReceiveFormOpen] = useState(false);
  
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card">
      <div className="absolute inset-0 bg-gradient-to-br from-muted/20 via-transparent to-transparent pointer-events-none" />
      <div className="relative">
        <Empty className="py-16 px-6">
          <EmptyHeader className="max-w-md mx-auto">
            <EmptyMedia variant="icon" className="size-14">
              <PackageOpenIcon className="size-8" strokeWidth={1.5} />
            </EmptyMedia>
            <EmptyTitle className="text-2xl font-bold tracking-tight">
              No valuation data yet
            </EmptyTitle>
            <EmptyDescription className="text-sm text-muted-foreground">
              Start receiving inventory to see your stock valuation and cost analysis here.
            </EmptyDescription>
          </EmptyHeader>

          <EmptyContent>
            <Button variant="outline" className="cursor-pointer rounded-sm" onClick={() => setIsReceiveFormOpen(true)}>
              Receive Stock
            </Button>
          </EmptyContent>
        </Empty>

        <ReceiveForm
            open={isReceiveFormOpen}
            onOpenChange={setIsReceiveFormOpen} 
            invalidateQueries={["inventory", "transactions", "trend", "valuation", "search", "skus"]}
        />
      </div>
    </div>
  );
}
