"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"

export function ShopifyErrorModal() {
  const [errorModal, setErrorModal] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: "",
    message: "",
  })
  const searchParams = useSearchParams()

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

  useEffect(() => {
    const error = searchParams.get('error')

    if (error) {
      const errorConfig: Record<string, { title: string; message: string }> = {
        invalid_hmac: {
          title: 'Security Verification Failed',
          message: "We couldn't verify the security signature from Shopify. This usually happens if the connection takes too long.",
        },
        session_expired: {
          title: 'Session Timed Out',
          message: 'The connection attempt took too long and expired. Please try again.',
        },
        shop_mismatch: {
          title: 'Store Mismatch',
          message: "The Shopify store you logged into doesn't match the one you initially entered. Please ensure you select the correct store.",
        },
        token_exchange_failed: {
          title: 'Connection Error',
          message: "We encountered a temporary issue while finalizing the link with Shopify.",
        },
        webhook_installation_failed: {
          title: 'Sync Setup Failed',
          message: "Nooryx connected to your shopify, but we failed to set up the automatic data sync. Please try again.",
        },
      }
      
      const config = errorConfig[error] || {
        title: 'Connection Failed',
        message: 'Something went wrong while connecting to Shopify. Please try again or contact support if the issue persists.',
      }

      setErrorModal({ open: true, ...config })
      
      // Clean up URL parameters so a refresh doesn't trigger it again
      const url = new URL(window.location.href)
      url.searchParams.delete('error')
      window.history.replaceState({}, '', url.toString())
    }
  }, [searchParams])

  const handleClose = () => {
    setErrorModal({ ...errorModal, open: false })
  }

  return (
    <Dialog open={errorModal.open} onOpenChange={(open) => setErrorModal({ ...errorModal, open })}>
      <DialogContent className="sm:max-w-[420px]">
        <style dangerouslySetInnerHTML={{__html: animationStyles}} />

        <div className="flex flex-col items-center text-center space-y-2 pt-6 pb-2">
          
          {/* Animated Error Icon */}
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

          <DialogTitle className="text-xl font-semibold tracking-tight text-foreground pt-2">
            {errorModal.title}
          </DialogTitle>
          
          <p className="text-sm text-muted-foreground max-w-[320px] mx-auto pb-4">
            {errorModal.message}
          </p>

          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Dismiss
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
