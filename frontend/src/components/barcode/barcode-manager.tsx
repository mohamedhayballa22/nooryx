"use client"

import { useState } from "react"
import { BarcodeScanner } from "./barcode-scanner"
import { OperationSelectModal } from "./operation-select-modal"
import { ReceiveForm } from "@/components/forms/receive-form"
import { ShipForm } from "@/components/forms/ship-form"
import { ReserveForm } from "@/components/forms/reserve-form"
import { UnreserveForm } from "@/components/forms/unreserve-form"
import { TransferForm } from "@/components/forms/transfer-form"
import { AdjustForm } from "@/components/forms/adjust-form"
import { useBarcodeLookup } from "@/hooks/use-barcode-lookup"

interface BarcodeManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BarcodeManager({ open, onOpenChange }: BarcodeManagerProps) {
  const [scannedBarcode, setScannedBarcode] = useState<string>("")
  const [barcodeFormat, setBarcodeFormat] = useState<string | undefined>(undefined)
  const [showOperationSelect, setShowOperationSelect] = useState(false)
  const [activeOperation, setActiveOperation] = useState<string | null>(null)

  const { sku, isLoading } = useBarcodeLookup(scannedBarcode)

  const handleScanSuccess = (barcode: string, format?: string) => {
    setScannedBarcode(barcode)
    setBarcodeFormat(format)
    setShowOperationSelect(true)
  }

  const handleSelectOperation = (operation: string) => {
    setActiveOperation(operation)
  }

  const handleFormClose = () => {
    setActiveOperation(null)
    setScannedBarcode("")
    setBarcodeFormat(undefined)
    setShowOperationSelect(false)
  }

  const skuContext = sku
    ? {
        sku_code: sku.code,
        sku_name: sku.name,
        alerts: sku.alerts,
        low_stock_threshold: sku.low_stock_threshold,
        reorder_point: sku.reorder_point,
      }
    : undefined

  return (
    <>
      {/* Barcode Scanner Modal */}
      <BarcodeScanner 
        open={open}
        onOpenChange={onOpenChange}
        onScanSuccess={handleScanSuccess}
      />

      {/* Operation Selection Modal */}
      <OperationSelectModal
        open={showOperationSelect}
        onOpenChange={setShowOperationSelect}
        onSelectOperation={handleSelectOperation}
        skuInfo={sku ? { code: sku.code, name: sku.name } : null}
        barcode={scannedBarcode}
        barcodeFormat={barcodeFormat}
        isLoading={isLoading}
      />

      {/* Conditionally-Mounted Forms */}
      {activeOperation === "receive" && (
        <ReceiveForm
          open
          onOpenChange={(open) => !open && handleFormClose()}
          invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
          skuContext={skuContext}
        />
      )}

      {activeOperation === "ship" && (
        <ShipForm
          open
          onOpenChange={(open) => !open && handleFormClose()}
          invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
          skuContext={skuContext}
        />
      )}

      {activeOperation === "reserve" && (
        <ReserveForm
          open
          onOpenChange={(open) => !open && handleFormClose()}
          invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
          skuContext={skuContext}
        />
      )}

      {activeOperation === "unreserve" && (
        <UnreserveForm
          open
          onOpenChange={(open) => !open && handleFormClose()}
          invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
          skuContext={skuContext}
        />
      )}

      {activeOperation === "transfer" && (
        <TransferForm
          open
          onOpenChange={(open) => !open && handleFormClose()}
          invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
          skuContext={skuContext}
        />
      )}

      {activeOperation === "adjust" && (
        <AdjustForm
          open
          onOpenChange={(open) => !open && handleFormClose()}
          invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
          skuContext={skuContext}
        />
      )}
    </>
  )
}
