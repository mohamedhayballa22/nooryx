"use client"

import { useState } from "react"
import { BarcodeScanner } from "./barcode-scanner"
import { OperationSelectModal } from "./operation-select-modal"
import { MapBarcodeModal } from "./map-barcode-modal"
import { ReceiveForm } from "@/components/forms/receive-form"
import { ShipForm } from "@/components/forms/ship-form"
import { ReserveForm } from "@/components/forms/reserve-form"
import { UnreserveForm } from "@/components/forms/unreserve-form"
import { TransferForm } from "@/components/forms/transfer-form"
import { AdjustForm } from "@/components/forms/adjust-form"
import { useBarcodeLookup } from "@/hooks/use-barcode-lookup"
import { type Option } from "../forms/searchable-autocomplete"
import { useSkuSearch } from "../forms/hooks/use-sku-search"

interface BarcodeManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BarcodeManager({ open, onOpenChange }: BarcodeManagerProps) {
  const [scannedBarcode, setScannedBarcode] = useState<string>("")
  const [barcodeFormat, setBarcodeFormat] = useState<string | undefined>(undefined)
  const [showOperationSelect, setShowOperationSelect] = useState(false)
  const [showMapBarcode, setShowMapBarcode] = useState(false)
  const [activeOperation, setActiveOperation] = useState<string | null>(null)

  // SKU search for mapping
  const [skuSearchQuery, setSkuSearchQuery] = useState("")
  const { data: searchResults, isLoading: isSearching } = useSkuSearch(skuSearchQuery)

  const { sku, isLoading } = useBarcodeLookup(scannedBarcode)

  const handleScanSuccess = (barcode: string, format?: string) => {
    setScannedBarcode(barcode)
    setBarcodeFormat(format)
    setShowOperationSelect(true)
  }

  const handleSelectOperation = (operation: string) => {
    setActiveOperation(operation)
  }

  const handleMapBarcode = () => {
    setShowMapBarcode(true)
  }

  const handleBackToOperations = () => {
    setShowMapBarcode(false)
    setShowOperationSelect(true)
  }

  const handleFormClose = () => {
    setActiveOperation(null)
    setScannedBarcode("")
    setBarcodeFormat(undefined)
    setShowOperationSelect(false)
    setShowMapBarcode(false)
    setSkuSearchQuery("")
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

  // Only pass barcode context if no SKU was found
  const barcodeContext = scannedBarcode && !sku ? {
    barcode_value: scannedBarcode,
    barcode_format: barcodeFormat ?? "Unknown"
  } : undefined

  // Convert SKU search results to options
  const skuOptions: Option[] = searchResults ?? []

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
        onMapBarcode={!sku ? handleMapBarcode : undefined}
        skuInfo={sku ? { code: sku.code, name: sku.name } : null}
        barcode={scannedBarcode}
        isLoading={isLoading}
      />

      {/* Map Barcode Modal */}
      <MapBarcodeModal
        open={showMapBarcode}
        onOpenChange={(open) => {
          setShowMapBarcode(open)
          if (!open) {
            setSkuSearchQuery("")
          }
        }}
        barcode={scannedBarcode}
        barcodeFormat={barcodeFormat}
        skuOptions={skuOptions}
        isLoadingSkus={isSearching}
        onSearchChange={setSkuSearchQuery}
        onBackToOperations={handleBackToOperations}
      />

      {/* Conditionally-Mounted Forms */}
      {activeOperation === "receive" && (
        <ReceiveForm
          open
          onOpenChange={(open) => !open && handleFormClose()}
          invalidateQueries={["inventory", "transactions", "trend", "valuation", "barcode", "search", "skus"]}
          skuContext={skuContext}
          barcodeContext={barcodeContext}
        />
      )}

      {activeOperation === "ship" && (
        <ShipForm
          open
          onOpenChange={(open) => !open && handleFormClose()}
          invalidateQueries={["inventory", "transactions", "trend", "valuation", "barcode"]}
          skuContext={skuContext}
          barcodeContext={barcodeContext}
        />
      )}

      {activeOperation === "reserve" && (
        <ReserveForm
          open
          onOpenChange={(open) => !open && handleFormClose()}
          invalidateQueries={["inventory", "transactions", "trend", "valuation", "barcode"]}
          skuContext={skuContext}
          barcodeContext={barcodeContext}
        />
      )}

      {activeOperation === "unreserve" && (
        <UnreserveForm
          open
          onOpenChange={(open) => !open && handleFormClose()}
          invalidateQueries={["inventory", "transactions", "trend", "valuation", "barcode"]}
          skuContext={skuContext}
          barcodeContext={barcodeContext}
        />
      )}

      {activeOperation === "transfer" && (
        <TransferForm
          open
          onOpenChange={(open) => !open && handleFormClose()}
          invalidateQueries={["inventory", "transactions", "trend", "valuation", "barcode"]}
          skuContext={skuContext}
          barcodeContext={barcodeContext}
        />
      )}

      {activeOperation === "adjust" && (
        <AdjustForm
          open
          onOpenChange={(open) => !open && handleFormClose()}
          invalidateQueries={["inventory", "transactions", "trend", "valuation", "barcode"]}
          skuContext={skuContext}
          barcodeContext={barcodeContext}
        />
      )}
    </>
  )
}
