"use client"

import { useEffect, useRef, useState } from "react"
import { BrowserMultiFormatReader, BarcodeFormat } from "@zxing/browser"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Camera } from "lucide-react"
import { cn } from "@/lib/utils"

interface BarcodeScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScanSuccess: (barcode: string, format?: string) => void
}

export function BarcodeScanner({ open, onOpenChange, onScanSuccess }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<any>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      stopScanning()
      return
    }

    startScanning()

    return () => {
      stopScanning()
    }
  }, [open])

  const startScanning = async () => {
    try {
      setError(null)
      setIsScanning(true)

      if (!readerRef.current) {
        readerRef.current = new BrowserMultiFormatReader()
      }

      const videoInputDevices = await BrowserMultiFormatReader.listVideoInputDevices()
      
      if (videoInputDevices.length === 0) {
        setError("No camera found")
        setIsScanning(false)
        return
      }

      // Prefer back camera on mobile devices
      const selectedDevice = videoInputDevices.find((device: MediaDeviceInfo) => 
        device.label.toLowerCase().includes('back')
      ) || videoInputDevices[0]

      controlsRef.current = await readerRef.current.decodeFromVideoDevice(
        selectedDevice.deviceId,
        videoRef.current!,
        (result: any, error: any) => {
            if (result) {
                const barcode = result.getText()
                const formatEnum = result.getBarcodeFormat()
                const format = BarcodeFormat[formatEnum]

                onScanSuccess(barcode, format)
                stopScanning()
                onOpenChange(false)
            }
            
            // Ignore common decoding errors (no barcode in frame)
            if (error && error.message !== 'No MultiFormat Readers were able to detect the code.') {
            console.error(error)
            }
        }
      )
    } catch (err) {
      console.error(err)
      setError("Failed to access camera. Please grant camera permissions.")
      setIsScanning(false)
    }
  }

  const stopScanning = () => {
    if (controlsRef.current) {
      controlsRef.current.stop()
      controlsRef.current = null
    }
    setIsScanning(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Scan Barcode</DialogTitle>
          </div>
        </DialogHeader>

        <div className="relative bg-black">
          <video
            ref={videoRef}
            className={cn(
              "w-full h-[400px] object-cover",
              !isScanning && "opacity-50"
            )}
          />
          
          {/* Scanning overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-64 h-64">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-lg" />
              
              {/* Scanning line animation */}
              {isScanning && (
                <div className="absolute inset-0 overflow-hidden">
                  <div className="absolute w-full h-0.5 bg-white animate-scan" />
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="text-center text-white px-4">
                <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-muted/30">
          <p className="text-sm text-muted-foreground text-center">
            Position the barcode within the frame
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
