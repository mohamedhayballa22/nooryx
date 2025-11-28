"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Check, X, Link as LinkIcon, AlertCircle } from "lucide-react"
import { SearchableAutocomplete, type Option } from "../forms/searchable-autocomplete"
import { Barcode, BoxIso } from "iconoir-react"
import { useLinkBarcode } from "@/hooks/use-link-barcode"

interface MapBarcodeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  barcode: string
  barcodeFormat?: string
  skuOptions: Option[]
  isLoadingSkus?: boolean
  onSearchChange?: (query: string) => void
  onBackToOperations?: () => void
}

export function MapBarcodeModal({
  open,
  onOpenChange,
  barcode,
  barcodeFormat,
  skuOptions,
  isLoadingSkus = false,
  onSearchChange,
  onBackToOperations,
}: MapBarcodeModalProps) {
  const [selectedSku, setSelectedSku] = React.useState<string>("")
  const [isMapping, setIsMapping] = React.useState(false)
  
  // States for UI feedback
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [isError, setIsError] = React.useState(false)
  
  const [mappedSkuInfo, setMappedSkuInfo] = React.useState<Option | null>(null)
  const linkBarcodeMutation = useLinkBarcode()

  const truncate = (val: string, limit = 25) =>
    val.length > limit ? val.slice(0, limit) + "..." : val

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      // Small delay to prevent UI flickering while modal closes
      const timer = setTimeout(() => {
        setSelectedSku("")
        setIsSuccess(false)
        setIsError(false)
        setMappedSkuInfo(null)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [open])

  const handleMap = async () => {
    if (!selectedSku) return
    setIsMapping(true)
    setIsError(false)

    try {
      await linkBarcodeMutation.mutateAsync({
        sku_code: selectedSku,
        barcode_value: barcode,
        barcode_format: barcodeFormat,
      })

      const skuInfo = skuOptions.find((opt) => opt.value === selectedSku)
      setMappedSkuInfo(skuInfo || null)
      setIsSuccess(true)
    } catch (error) {
      console.error(error)
      setIsError(true)
    } finally {
      setIsMapping(false)
    }
  }

  const handleBackToOperations = () => {
    onOpenChange(false)
    onBackToOperations?.()
  }

  const handleClose = () => {
    onOpenChange(false)
  }
  
  const handleRetry = () => {
    setIsError(false)
    // We keep selectedSku intact so the user can just click "Link" again
  }

  // SHARED ANIMATION STYLES
  const animationStyles = `
    @keyframes linear-draw {
      0% { stroke-dashoffset: 100; opacity: 0; }
      100% { stroke-dashoffset: 0; opacity: 1; }
    }
    @keyframes spring-pop {
      0% { transform: scale(0.8); opacity: 0; }
      40% { transform: scale(1.08); opacity: 1; }
      100% { transform: scale(1); opacity: 1; }
    }
    .animate-stroke-draw path, .animate-stroke-draw line, .animate-stroke-draw polyline {
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
      animation: linear-draw 0.6s cubic-bezier(0.65, 0, 0.35, 1) 0.15s forwards;
    }
    .animate-icon-pop {
      animation: spring-pop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
  `

  // ERROR SCREEN
  if (isError) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[420px]">
          <style dangerouslySetInnerHTML={{__html: animationStyles}} />

          <div className="flex flex-col items-center text-center space-y-2 pt-6 pb-2">
            
            {/* Error Icon */}
            <div className="p-2 mb-2">
              <div className="relative flex items-center justify-center">
                {/* Red Glow */}
                <div className="absolute w-20 h-20 rounded-full bg-red-500/20 animate-in fade-in zoom-in-50 duration-500" />
                
                {/* Main Red Circle */}
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500 shadow-md animate-icon-pop opacity-0">
                  {/* X Icon - Stroke Animation */}
                  <X className="w-8 h-8 text-white stroke-[4] animate-stroke-draw" />
                </div>
              </div>
            </div>

            <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
              Linking Failed
            </DialogTitle>
            
            <p className="text-sm text-muted-foreground max-w-[300px] mx-auto pb-4">
              We couldn't link the barcode to this SKU. Please check your connection or try again.
            </p>

            {/* Actions */}
            <div className="flex gap-3 w-full pt-2">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleRetry} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                Try Again
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // SUCCESS SCREEN
  if (isSuccess && mappedSkuInfo) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[420px]">
          <style dangerouslySetInnerHTML={{__html: animationStyles}} />

          <div className="flex flex-col items-center text-center space-y-2 pt-6 pb-2">

            {/* Success Icon */}
            <div className="p-2 mb-2">
              <div className="relative flex items-center justify-center">
                <div className="absolute w-20 h-20 rounded-full bg-green-500/20 animate-in fade-in zoom-in-50 duration-500" />
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-green-500 shadow-md animate-icon-pop opacity-0">
                  <Check className="w-8 h-8 text-white stroke-[4] animate-stroke-draw" />
                </div>
              </div>
            </div>

            <DialogTitle className="text-xl font-semibold tracking-tight">
              Barcode Linked
            </DialogTitle>
            <p className="text-sm text-muted-foreground max-w-[300px] mx-auto">
              Scan events for this barcode will now automatically resolve to the selected SKU.
            </p>

            {/* Connection Visual */}
            <div className="w-full py-6">
              <div className="relative flex flex-col items-center">
                {/* Vertical connecting line */}
                <div className="absolute left-1/2 top-4 bottom-4 w-px -ml-[0.5px] bg-border" />

                {/* Barcode Node */}
                <div className="relative z-10 w-full bg-card border rounded-xl p-3 shadow-sm flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/5 text-primary shrink-0">
                    <Barcode className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Barcode
                    </p>
                    <p className="font-mono text-sm font-medium">
                      {truncate(barcode)}
                    </p>
                  </div>
                </div>

                {/* Link Node */}
                <div className="relative z-20 my-[-10px]">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-background border shadow-sm ring-4 ring-background text-muted-foreground">
                    <LinkIcon className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* SKU Node */}
                <div className="relative z-10 w-full bg-card border rounded-xl p-3 shadow-sm flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/5 text-primary shrink-0">
                    <BoxIso className="w-5 h-5" />
                  </div>

                  <div className="text-left overflow-hidden">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                      SKU
                    </p>

                    <p className="font-semibold text-sm truncate">
                      {truncate(mappedSkuInfo.label)}
                    </p>

                    {mappedSkuInfo.metadata?.name && (
                      <p className="text-xs text-muted-foreground truncate">
                        {truncate(mappedSkuInfo.metadata.name, 20)}
                      </p>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 w-full pt-2">
              <Button variant="outline" onClick={handleBackToOperations} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Select Operation
              </Button>
              <Button onClick={handleClose} className="flex-1">
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // MAIN FORM
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Link Barcode to SKU
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg border">
            <p className="text-xs text-muted-foreground mb-1">Barcode</p>
            <p className="font-mono text-sm break-all">
              {truncate(barcode)}
            </p>
          </div>

          <div className="space-y-2">
            <div className="mb-2">
                <label className="text-sm font-medium">Select SKU</label>
            </div>

            <SearchableAutocomplete
              options={skuOptions}
              value={selectedSku}
              onChange={(value) => setSelectedSku(value)}
              placeholder="Search for SKU..."
              isLoading={isLoadingSkus}
              onSearchChange={onSearchChange}
              allowCreate={false}
              allowClear={true}
              emptyText="No SKUs found"
              transformInput={(val) => val.toUpperCase()}
            />

            <p className="text-xs text-muted-foreground">
              Search and select an existing SKU to link with this barcode
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={isMapping}
          >
            Cancel
          </Button>

          <Button
            variant="default"
            className="flex-1"
            onClick={handleMap}
            disabled={!selectedSku || isMapping}
          >
            {isMapping ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Linking...
              </>
            ) : (
              "Link Barcode"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
