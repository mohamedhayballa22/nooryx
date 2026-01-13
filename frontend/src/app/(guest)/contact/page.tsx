"use client";

import { NooryxFontBold } from "@/app/fonts/typeface";
import { useState } from "react";
import { Copy, Check } from "lucide-react";

export default function ContactPage() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText("contact@nooryx.com");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <div className="flex justify-center items-center px-4 pb-10">
      <div className="w-full max-w-xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="space-y-3">
            <h1 className={`${NooryxFontBold.className} text-4xl font-semibold tracking-tight`}>
              Let's talk
            </h1>
            <p className="text-lg text-muted-foreground">
              Questions about Nooryx? Want to see how we can help your team
              manage inventory with clarity and confidence? We'd love to hear
              from you.
            </p>
          </div>

          {/* Email Section */}
          <div className="border rounded-lg p-8 space-y-4 relative">
            <button
              onClick={copyToClipboard}
              className="absolute top-4 right-4 p-2 hover:bg-accent rounded-md transition-colors cursor-pointer"
              aria-label="Copy email to clipboard" 
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            
            <div className="space-y-1">
              <div className="text-xs font-small text-muted-foreground uppercase tracking-wide">
                Email
              </div>
              
              <a
                href="mailto:contact@nooryx.com"
                className={`${NooryxFontBold.className} text-2xl font-medium hover:underline underline-offset-4 transition-all block cursor-pointer`}
              >
                contact@nooryx.com
              </a>

            </div>
          </div>

          {/* Additional info */}
          <div className="pt-4 space-y-4 text-sm text-muted-foreground border-t">
            <p>
              We respond to every message within 24 hours, usually much faster.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
