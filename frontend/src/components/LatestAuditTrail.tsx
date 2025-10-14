"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AuditTrail } from "@/components/audit-trail"
import { EmptySkuTxn } from "@/components/empty-sku-txn"
import type { LatestAuditTrailData } from "@/lib/api/inventory"
import { ExternalLink } from "lucide-react"

export function LatestAuditTrail({ sku, locations, location, transactions }: LatestAuditTrailData) {

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle>Latest Movements - {sku}</CardTitle>
        <CardDescription>
          {location
            ? `${location}`
            : locations === 1
            ? `Single Location view`
            : "All Locations"}
        </CardDescription>
      </CardHeader>
      <CardContent 
        className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-transparent hover:[&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'transparent transparent' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.scrollbarColor = 'rgb(209 213 219) transparent'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.scrollbarColor = 'transparent transparent'
        }}
      >
        {transactions.length === 0 ? (
          <EmptySkuTxn />
        ) : (
          <>
            <AuditTrail items={transactions} snippet={true}/>
            
            <div className="flex justify-center py-5 mt-4">
              <Button 
                variant="outline" 
                onClick={() => window.open('/core/audit-trail?search=' + sku, '_blank')}
                className="cursor-pointer"
              >
                View Full History
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

LatestAuditTrail.Skeleton = function LatestAuditTrailSkeleton() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 space-y-2">
        <Skeleton className="h-6 w-1/3" /> 
        <Skeleton className="h-4 w-1/4" />
      </CardHeader>
      <CardContent 
        className="flex-1 overflow-y-auto space-y-4 [&::-webkit-scrollbar]:hidden"
      >
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

        <div className="flex justify-center py-5 mt-4">
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </CardContent>
    </Card>
  )
}
