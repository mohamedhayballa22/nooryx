"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { 
  Package, 
  Lock, 
  Unlock, 
  ArrowLeftRight, 
  LinkIcon,
  AlertCircle,
  ChevronRight
} from "lucide-react"
import { DeliveryTruck, Edit } from "iconoir-react"
import Link from "next/link"

interface OperationSelectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectOperation: (operation: string) => void
  onMapBarcode?: () => void 
  skuInfo?: {
    code: string
    name: string
  } | null
  barcode: string
  isLoading?: boolean
}

export function OperationSelectModal({ 
  open, 
  onOpenChange, 
  onSelectOperation,
  onMapBarcode,
  skuInfo,
  barcode,
  isLoading = false
}: OperationSelectModalProps) {
  const operations = [
    { id: "receive", label: "Receive", icon: Package, description: "Add stock" },
    { id: "ship", label: "Ship", icon: (props: any) => <DeliveryTruck {...props} strokeWidth={2} />, description: "Remove stock" },
    { id: "reserve", label: "Reserve", icon: Lock, description: "Reserve stock for orders" },
    { id: "unreserve", label: "Unreserve", icon: Unlock, description: "Release reserved stock" },
    { id: "transfer", label: "Transfer", icon: ArrowLeftRight, description: "Move between locations" },
    { id: "adjust", label: "Adjust", icon: (props: any) => <Edit {...props} strokeWidth={2} />, description: "Manual adjustment" },
  ]

  const truncate = (val: string, limit = 25) =>
    val.length > limit ? val.slice(0, limit) + "..." : val

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md gap-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium tracking-tight">
            Select Operation
          </DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="p-4 bg-muted/40 rounded-lg border border-border/50">
            <div className="animate-pulse space-y-3">
              <div className="h-3 w-20 bg-muted-foreground/10 rounded" />
              <div className="h-5 w-32 bg-muted-foreground/10 rounded" />
              <div className="h-3 w-48 bg-muted-foreground/10 rounded" />
            </div>
          </div>
        ) : skuInfo ? (
          <Link 
            href={`/core/inventory?sku=${encodeURIComponent(skuInfo.code)}`}
            className="block p-3 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/50 hover:border-foreground/20 transition-all duration-200 group"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Scanned SKU</p>
                <p className="font-semibold text-sm break-words">{skuInfo.code}</p>
                <p className="text-sm text-muted-foreground break-words">{skuInfo.name}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0 mt-0.5" />
            </div>
          </Link>
        ) : (
          <div className="space-y-4">
            <div className="group relative flex flex-col items-center justify-center p-6 rounded-lg border border-border/50 bg-muted/20 text-center transition-colors">
              
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 mb-3">
                <AlertCircle className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Unknown Barcode</span>
              </div>

              <div className="relative mb-3">
                <code className="relative px-3 py-1.5 rounded-md bg-background border border-border text-sm font-mono font-medium shadow-sm">
                  {truncate(barcode)}
                </code>
              </div>

              <p className="text-sm text-muted-foreground max-w-[240px] leading-relaxed">
                This barcode hasn't been linked to an SKU in your inventory yet.
              </p>

              {onMapBarcode && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 h-8 text-xs font-medium"
                  onClick={() => {
                    onMapBarcode()
                    onOpenChange(false)
                  }}
                >
                  <LinkIcon className="h-3 w-3 mr-2" />
                  Link to Existing SKU
                </Button>
              )}
            </div>

            {/* Subtle divider with helper text */}
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground/60 font-medium">
                  Or
                </span>
              </div>
            </div>
            <div className="text-center">
               <span className="text-xs text-muted-foreground">Continue with an operation to link automatically</span>
            </div>
          </div>
        )}

        {/* Operation Grid */}
        <div className="grid grid-cols-2 gap-3">
          {operations.map((operation) => (
            <Button
              key={operation.id}
              variant="outline"
              className="group relative h-auto min-h-[90px] flex flex-col items-start justify-start p-3.5 hover:bg-muted/50 hover:border-foreground/20 transition-all duration-200 whitespace-normal text-left"
              onClick={() => {
                onSelectOperation(operation.id)
                onOpenChange(false)
              }}
              disabled={isLoading}
            >
              <div className="flex flex-col items-start w-full min-w-0 gap-2">
                <div className="text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0">
                  <operation.icon className="h-5 w-5" />
                </div>
                <div className="space-y-0.5 text-left w-full min-w-0">
                  <span className="block font-medium text-sm text-foreground break-words w-full">
                    {operation.label}
                  </span>
                  <span className="block text-xs text-muted-foreground font-normal leading-tight break-words w-full">
                    {operation.description}
                  </span>
                </div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
