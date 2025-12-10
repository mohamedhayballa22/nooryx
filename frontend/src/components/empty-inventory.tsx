"use client";

import { useState } from "react";
import { PackageOpenIcon, ScanBarcode } from "lucide-react";
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
import { BarcodeManager } from "./barcode/barcode-manager";

export function EmptyInventory() {
  const [isReceiveFormOpen, setIsReceiveFormOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  return (
    <>
      <Empty className="h-[calc(100vh-8rem)] flex flex-col items-center justify-center text-center px-6 -mt-8">
        <EmptyHeader className="2 max-w-2xl mx-auto">
          <EmptyMedia variant="icon" className="size-16">
            <PackageOpenIcon className="size-10" strokeWidth={1.5} />
          </EmptyMedia>
          <EmptyTitle className="text-3xl md:text-4xl font-bold tracking-tight">
            Quiet warehouse, isn&apos;t it?
          </EmptyTitle>
          <EmptyDescription className="text-base md:text-lg text-muted-foreground max-w-md mx-auto">
            No boxes, no bins, just potential. Add some items and let&apos;s fill these shelves.
          </EmptyDescription>
        </EmptyHeader>

        <EmptyContent>
          <div className="flex flex-col md:flex-row gap-3 justify-center">
            <Button
              variant="outline"
              className="cursor-pointer rounded-sm w-full md:w-auto"
              onClick={() => setIsReceiveFormOpen(true)}
            >
              Receive Stock
            </Button>

            <Button
              variant="outline"
              className="cursor-pointer rounded-sm w-full md:w-auto"
              onClick={() => setScannerOpen(true)}
            >
              <ScanBarcode className="mr-2 h-4 w-4" />
              Scan Barcode
            </Button>
          </div>
        </EmptyContent>
      </Empty>

      <ReceiveForm
        open={isReceiveFormOpen}
        onOpenChange={setIsReceiveFormOpen}
        invalidateQueries={[
          "inventory",
          "transactions",
          "trend",
          "valuation",
          "search",
          "skus",
        ]}
      />

      <BarcodeManager open={scannerOpen} onOpenChange={setScannerOpen} emptyInventory={true} />
    </>
  );
}
