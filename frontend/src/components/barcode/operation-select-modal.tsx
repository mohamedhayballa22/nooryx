"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { 
  Package, 
  Truck, 
  Lock, 
  Unlock, 
  ArrowLeftRight, 
  Settings 
} from "lucide-react"

interface OperationSelectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectOperation: (operation: string) => void
  skuInfo?: {
    code: string
    name: string
  } | null
  barcode: string
}

interface OperationSelectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectOperation: (operation: string) => void
  skuInfo?: {
    code: string
    name: string
  } | null
  barcode: string
  barcodeFormat?: string
  isLoading?: boolean
}

export function OperationSelectModal({ 
  open, 
  onOpenChange, 
  onSelectOperation,
  skuInfo,
  barcode,
  barcodeFormat,
  isLoading = false
}: OperationSelectModalProps) {
  const operations = [
    { id: "receive", label: "Receive", icon: Package, description: "Add stock to inventory" },
    { id: "ship", label: "Ship", icon: Truck, description: "Remove stock from inventory" },
    { id: "reserve", label: "Reserve", icon: Lock, description: "Reserve stock for orders" },
    { id: "unreserve", label: "Unreserve", icon: Unlock, description: "Release reserved stock" },
    { id: "transfer", label: "Transfer", icon: ArrowLeftRight, description: "Move between locations" },
    { id: "adjust", label: "Adjust", icon: Settings, description: "Manual inventory adjustment" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Select Operation
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          // Loading skeleton
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border">
            <div className="animate-pulse">
              <div className="h-3 w-20 bg-muted-foreground/20 rounded mb-2" />
              <div className="h-5 w-32 bg-muted-foreground/20 rounded mb-2" />
              <div className="h-4 w-48 bg-muted-foreground/20 rounded" />
            </div>
          </div>
        ) : skuInfo ? (
          <div className="mb-4 p-3 bg-muted/50 rounded-lg border">
            <p className="text-xs text-muted-foreground mb-1">Scanned SKU</p>
            <p className="font-semibold">{skuInfo.code}</p>
            <p className="text-sm text-muted-foreground">{skuInfo.name}</p>
          </div>
        ) : (
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <p className="text-xs text-yellow-800 dark:text-yellow-200 mb-1">
              Unknown Barcode
            </p>
            <p className="font-mono text-sm">{barcode}</p>
            <p className="text-xs text-muted-foreground mt-1">
              No SKU currently uses this barcode.
              Choose an operation and select or create a SKU — we’ll attach the barcode automatically.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {operations.map((operation) => (
            <Button
              key={operation.id}
              variant="outline"
              className="h-auto flex-col items-start p-4 hover:bg-accent"
              onClick={() => {
                onSelectOperation(operation.id)
                onOpenChange(false)
              }}
              disabled={isLoading}
            >
              <operation.icon className="h-5 w-5 mb-2" />
              <span className="font-medium text-sm">{operation.label}</span>
              <span className="text-xs text-muted-foreground font-normal mt-1">
                {operation.description}
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}