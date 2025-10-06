"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AuditTrail } from "@/components/audit-trail"
import type { SkuAuditTrailData } from "@/lib/api/inventory"

export function SkuAuditTrail({ sku, locations, location, transactions }: SkuAuditTrailData) {
  const handleViewFullHistory = () => {
    // Add your navigation/modal logic here
    console.log("View full history clicked")
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle>Latest Movements - {sku}</CardTitle>
        <CardDescription>
          {location
            ? `Location: ${location}`
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
        <AuditTrail items={transactions} snippet={true}/>
        
        <div className="flex justify-center py-5 mt-4">
          <Button 
            variant="outline" 
            onClick={handleViewFullHistory}
            className="cursor-pointer"
          >
            View Full History
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
