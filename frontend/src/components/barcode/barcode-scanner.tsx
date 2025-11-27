"use client"

import { useEffect, useRef, useState } from "react"
import { BrowserMultiFormatReader, BarcodeFormat } from "@zxing/browser"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Camera, Keyboard, AlertCircle, X, ScanBarcode, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

type ScanMethod = "camera" | "hardware" | "manual" | null

function HandheldScannerIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <path d="M7 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-3l-2 7H8l2-7H9a2 2 0 0 1-2-2V7z" />
    </svg>
  )
}

interface BarcodeScannerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onScanSuccess: (barcode: string, format?: string) => void
}

const STORAGE_KEY = "barcode-scan-method"

export function BarcodeScanner({ open, onOpenChange, onScanSuccess }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const controlsRef = useRef<any>(null)
  const hardwareScanInputRef = useRef<HTMLInputElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  
  const [scanMethod, setScanMethod] = useState<ScanMethod>(null)
  const [showMethodPicker, setShowMethodPicker] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualBarcode, setManualBarcode] = useState("")
  const [manualError, setManualError] = useState<string | null>(null)

  // Initialize AudioContext on user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      }
    }

    // Initialize on first user interaction
    document.addEventListener('click', initAudio, { once: true })
    document.addEventListener('touchstart', initAudio, { once: true })

    return () => {
      document.removeEventListener('click', initAudio)
      document.removeEventListener('touchstart', initAudio)
    }
  }, [])

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current?.state !== 'closed') {
        audioContextRef.current?.close()
      }
    }
  }, [])

  // Play beep sound using Web Audio API
  const playBeep = () => {
    try {
      const audioContext = audioContextRef.current
      if (!audioContext) return

      // Resume context if suspended (required for autoplay policies)
      if (audioContext.state === 'suspended') {
        audioContext.resume()
      }

      // Create oscillator for beep sound
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Configure beep: 800Hz frequency, short duration
      oscillator.frequency.value = 800
      oscillator.type = 'sine'

      // Envelope for smooth sound (avoid clicks)
      const now = audioContext.currentTime
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(0.3, now + 0.01) // Quick attack
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15) // Decay

      oscillator.start(now)
      oscillator.stop(now + 0.15)
    } catch (err) {
      console.warn('Failed to play beep sound:', err)
      // Silently fail - audio is not critical
    }
  }

  // Load saved preference on mount
  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem(STORAGE_KEY) as ScanMethod
      if (saved && ["camera", "hardware", "manual"].includes(saved)) {
        setScanMethod(saved)
      } else {
        setShowMethodPicker(true)
      }
    } else {
      // Reset state when closed
      stopScanning()
      setScanMethod(null)
      setShowMethodPicker(false)
      setManualBarcode("")
      setManualError(null)
    }
  }, [open])

  // Start appropriate scanning method
  useEffect(() => {
    if (!open || !scanMethod) return

    if (scanMethod === "camera") {
      startCameraScanning()
    } else if (scanMethod === "hardware") {
      // Focus the hidden input for hardware scanners
      setTimeout(() => hardwareScanInputRef.current?.focus(), 100)
    }

    return () => {
      stopScanning()
    }
  }, [open, scanMethod])

  // Helper to ensure focus stays on the hidden input in hardware mode
  const ensureFocus = () => {
    if (scanMethod === "hardware" && hardwareScanInputRef.current) {
      hardwareScanInputRef.current.focus()
    }
  }

  const handleMethodSelect = (method: ScanMethod) => {
    localStorage.setItem(STORAGE_KEY, method!)
    setScanMethod(method)
    setShowMethodPicker(false)
  }

  const handleSwitchMethod = () => {
    stopScanning()
    setShowMethodPicker(true)
    setScanMethod(null)
  }

  const startCameraScanning = async () => {
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
            
            // Play beep sound on successful scan
            playBeep()
            
            onScanSuccess(barcode, format)
            stopScanning()
            onOpenChange(false)
          }
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

  // Handle input changes - no auto-submit
  const handleHardwareInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setManualBarcode(e.target.value)
  }

  const handleHardwareScan = (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmed = manualBarcode.trim()
    if (!trimmed || trimmed.length < 3) return
    
    onScanSuccess(trimmed, "HARDWARE_SCANNER")
    onOpenChange(false)
  }

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    const trimmed = manualBarcode.trim()
    if (!trimmed) {
      setManualError("Please enter a barcode")
      return
    }

    if (trimmed.length < 3) {
      setManualError("Barcode must be at least 3 characters")
      return
    }

    setManualError(null)
    onScanSuccess(trimmed, "MANUAL_ENTRY")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Inject custom keyframe for the scanner beam visual */}
      <style jsx global>{`
        @keyframes scan-beam {
          0%, 100% { transform: translateY(-100%); opacity: 0; }
          15% { opacity: 1; }
          50% { transform: translateY(100%); opacity: 1; }
          85% { opacity: 1; }
        }
        .animate-scan-beam {
          animation: scan-beam 2.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
      `}</style>

      <DialogContent className="sm:max-w-2xl p-0 gap-0 border shadow-xl" showCloseButton={false}>
        {showMethodPicker ? (
          <div className="flex flex-col">
            <DialogHeader className="px-6 py-5 border-b bg-background/50">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-base font-medium tracking-tight">
                    Choose Scan Method
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select how you would like to input the barcode.
                  </p>
                </div>
                <DialogClose asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-muted">
                    <X className="h-4 w-4 text-muted-foreground" />
                    <span className="sr-only">Close</span>
                  </Button>
                </DialogClose>
              </div>
            </DialogHeader>

            <div className="p-4 grid gap-3 bg-muted/5">
              {/* Option 1: Hardware */}
              <button
                onClick={() => handleMethodSelect("hardware")}
                className="group relative flex items-center w-full gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:bg-accent/50 hover:border-foreground/20 cursor-pointer"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground group-hover:border-foreground/20">
                  <HandheldScannerIcon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground">Hardware Scanner</h3>
                  <p className="text-xs text-muted-foreground">USB or Bluetooth handheld device</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </button>

              {/* Option 2: Camera */}
              <button
                onClick={() => handleMethodSelect("camera")}
                className="group relative flex items-center w-full gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:bg-accent/50 hover:border-foreground/20 cursor-pointer"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground group-hover:border-foreground/20">
                  <Camera className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground">Camera</h3>
                  <p className="text-xs text-muted-foreground">Use your device camera</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </button>

              {/* Option 3: Manual */}
              <button
                onClick={() => handleMethodSelect("manual")}
                className="group relative flex items-center w-full gap-4 rounded-xl border border-border bg-card p-4 text-left transition-all hover:bg-accent/50 hover:border-foreground/20 cursor-pointer"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors group-hover:text-foreground group-hover:border-foreground/20">
                  <Keyboard className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-foreground">Manual Entry</h3>
                  <p className="text-xs text-muted-foreground">Type the barcode number</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader className="px-6 py-4 border-b">
              <div className="flex items-center justify-between">
                <DialogTitle className="text-lg font-semibold">
                  {scanMethod === "camera" && "Scan with Camera"}
                  {scanMethod === "hardware" && "Scan Barcode"}
                  {scanMethod === "manual" && "Enter Barcode"}
                </DialogTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSwitchMethod}
                    className="text-xs"
                  >
                    Switch method
                  </Button>
                  <DialogClose asChild>
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                      <X className="h-4 w-4" />
                      <span className="sr-only">Close</span>
                    </Button>
                  </DialogClose>
                </div>
              </div>
            </DialogHeader>

            {scanMethod === "camera" && (
              <>
                <div className="relative bg-black">
                  <video
                    ref={videoRef}
                    className={cn(
                      "w-full h-[400px] object-cover",
                      !isScanning && "opacity-50"
                    )}
                  />

                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative w-64 h-64">
                      <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-lg" />

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
                        <p className="text-sm mb-4">{error}</p>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleSwitchMethod}
                        >
                          Try another method
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t bg-muted/30">
                  <p className="text-sm text-muted-foreground text-center">
                    Position the barcode within the frame
                  </p>
                </div>
              </>
            )}

            {scanMethod === "hardware" && (
              <div 
                className="p-8 flex flex-col items-center justify-center min-h-[350px] cursor-text"
                onClick={ensureFocus}
              >
                {/* Visual Scanner Animation */}
                <div className="relative w-48 h-32 mb-8 group">
                  {/* The Background Card */}
                  <div className="absolute inset-0 bg-muted/20 border border-border rounded-xl flex items-center justify-center overflow-hidden">
                    {/* Faint static barcode */}
                    <ScanBarcode className="w-16 h-16 text-muted-foreground/20" />
                    
                    {/* The Scan Beam Animation */}
                    <div className="absolute inset-0 animate-scan-beam bg-gradient-to-b from-transparent via-primary/10 to-transparent w-full" />
                    <div className="absolute inset-x-0 h-[1px] bg-primary/40 shadow-[0_0_10px_rgba(0,0,0,0.1)] animate-scan-beam" />
                  </div>

                  {/* Pulsing Ring (The "Listening" state) */}
                  <div className="absolute -inset-3 border border-primary/20 rounded-2xl animate-pulse" />
                  <div className="absolute -inset-1 border border-primary/10 rounded-[14px]" />
                </div>

                <div className="text-center space-y-2 max-w-xs mx-auto relative z-10">
                  <h3 className="text-base font-medium">Ready to scan</h3>
                  <p className="text-sm text-muted-foreground">
                    Point your scanner at the barcode. <br/>
                  </p>
                </div>

                <form onSubmit={handleHardwareScan} className="absolute opacity-0 w-0 h-0 overflow-hidden">
                  <Input
                    ref={hardwareScanInputRef}
                    type="text"
                    value={manualBarcode}
                    onChange={handleHardwareInput}
                    className="opacity-0 h-0 w-0 absolute pointer-events-none"
                    autoFocus
                    autoComplete="off"
                    inputMode="none" 
                  />
                </form>
              </div>
            )}

            {scanMethod === "manual" && (
              <div className="p-6">
                <form onSubmit={handleManualSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="barcode-input">Barcode Number</Label>
                    <Input
                      id="barcode-input"
                      type="text"
                      value={manualBarcode}
                      onChange={(e) => {
                        setManualBarcode(e.target.value)
                        setManualError(null)
                      }}
                      placeholder="Enter barcode number"
                      className="mt-2"
                      autoFocus
                      autoComplete="off"
                    />
                    {manualError && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {manualError}
                      </p>
                    )}
                  </div>

                  <Button type="submit" className="w-full" disabled={!manualBarcode.trim()}>
                    Continue
                  </Button>
                </form>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
