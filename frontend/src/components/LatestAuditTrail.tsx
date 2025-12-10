"use client"

import Link from "next/link"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AuditTrail } from "@/components/audit-trail"
import { EmptyLatestAuditTrail } from "@/components/EmptyLatestAuditTrail"
import type { LatestAuditTrailData } from "@/lib/api/inventory"

export function LatestAuditTrail({ sku_code, location, transactions }: LatestAuditTrailData) {
  const historyUrl = sku_code
    ? `/core/audit-trail?search=${encodeURIComponent(sku_code)}`
    : '/core/audit-trail';

  const hasTransactions = transactions.length > 0;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="mb-1">Latest Movements</CardTitle>
            <CardDescription>
              {location ? location : "All Locations"}
            </CardDescription>
          </div>
          
          {/* Button shown on larger screens - only when there are transactions */}
          {hasTransactions && (
            <Link href={historyUrl} className="hidden sm:block">
              <Button variant="outline" size="sm" className="cursor-pointer whitespace-nowrap">
                View Full History
              </Button>
            </Link>
          )}
        </div>
      </CardHeader>

      <CardContent
        className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full"
        style={{ scrollbarWidth: "thin", scrollbarColor: "transparent transparent" }}
        onMouseEnter={(e) => {
          e.currentTarget.style.scrollbarColor = "rgb(209 213 219) transparent"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.scrollbarColor = "transparent transparent"
        }}
      >
        {hasTransactions ? (
          <>
            <AuditTrail items={transactions} snippet={true} />

            {/* Button shown on mobile/small screens */}
            <div className="flex justify-center mt-4 sm:hidden">
              <Link href={historyUrl}>
                <Button variant="outline" className="cursor-pointer">
                  View Full History
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <EmptyLatestAuditTrail />
        )}
      </CardContent>
    </Card>
  )
}

LatestAuditTrail.Skeleton = function LatestAuditTrailSkeleton() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-1/3" /> 
            <Skeleton className="h-4 w-1/4" />
          </div>
          <Skeleton className="hidden sm:block h-9 w-32 rounded-md" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-4 [&::-webkit-scrollbar]:hidden">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-3 w-3 rounded-full mt-1" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-center py-5 mt-4 sm:hidden">
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </CardContent>
    </Card>
  )
}
