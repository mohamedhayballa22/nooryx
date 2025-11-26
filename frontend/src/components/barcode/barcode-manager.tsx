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
import { useQuery } from "@tanstack/react-query"

interface SkuLookupResponse {
  code: string
  org_id: string
  name: string
  alerts: boolean
  low_stock_threshold: number
  reorder_point: number
  created_at: string
}

interface BarcodeManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BarcodeManager({ open, onOpenChange }: BarcodeManagerProps) {
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null)
  const [barcodeFormat, setBarcodeFormat] = useState<string | undefined>(undefined)
  const [showOperationSelect, setShowOperationSelect] = useState(false)
  const [activeOperation, setActiveOperation] = useState<string | null>(null)

  const { data: skuData, isLoading } = useQuery<SkuLookupResponse | null>({
    queryKey: ["sku-lookup", scannedBarcode],
    queryFn: async () => {
      if (!scannedBarcode) return null
      
      // API call
      const response = await fetch(`/api/barcodes/lookup?value=${scannedBarcode}`)
      if (!response.ok) return null
      return response.json()
    },
    enabled: !!scannedBarcode,
  })

  const handleScanSuccess = (barcode: string, format?: string) => {
    setScannedBarcode(barcode)
    setBarcodeFormat(format)
    setShowOperationSelect(true) // Show immediately, don't wait for lookup
  }

  const handleSelectOperation = (operation: string) => {
    setActiveOperation(operation)
  }

  const handleFormClose = () => {
    setActiveOperation(null)
    setScannedBarcode(null)
    setBarcodeFormat(undefined)
    setShowOperationSelect(false)
  }

  const skuContext = skuData ? {
    sku_code: skuData.code,
    sku_name: skuData.name,
    alerts: skuData.alerts,
    low_stock_threshold: skuData.low_stock_threshold,
    reorder_point: skuData.reorder_point,
  } : undefined

  return (
    <>
      <BarcodeScanner
        open={open}
        onOpenChange={onOpenChange}
        onScanSuccess={handleScanSuccess}
      />

      <OperationSelectModal
        open={showOperationSelect}
        onOpenChange={setShowOperationSelect}
        onSelectOperation={handleSelectOperation}
        skuInfo={skuData ? { code: skuData.code, name: skuData.name } : null}
        barcode={scannedBarcode || ""}
        barcodeFormat={barcodeFormat}
        isLoading={isLoading}
      />

      {/* Operation Forms */}
      <ReceiveForm
        open={activeOperation === "receive"}
        onOpenChange={(open) => !open && handleFormClose()}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
        skuContext={skuContext}
      />
      <ShipForm
        open={activeOperation === "ship"}
        onOpenChange={(open) => !open && handleFormClose()}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
        skuContext={skuContext}
      />
      <ReserveForm
        open={activeOperation === "reserve"}
        onOpenChange={(open) => !open && handleFormClose()}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
        skuContext={skuContext}
      />
      <UnreserveForm
        open={activeOperation === "unreserve"}
        onOpenChange={(open) => !open && handleFormClose()}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
        skuContext={skuContext}
      />
      <TransferForm
        open={activeOperation === "transfer"}
        onOpenChange={(open) => !open && handleFormClose()}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
        skuContext={skuContext}
      />
      <AdjustForm
        open={activeOperation === "adjust"}
        onOpenChange={(open) => !open && handleFormClose()}
        invalidateQueries={["inventory", "transactions", "trend", "valuation"]}
        skuContext={skuContext}
      />
    </>
  )
}
