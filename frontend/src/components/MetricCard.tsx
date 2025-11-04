import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardFooter,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: string | number
  delta?: number
  description?: string
  subtitle?: string
}

export function MetricCard({
  title,
  value,
  delta,
  description,
  subtitle,
}: MetricCardProps) {
  const isPositive = delta !== undefined && delta >= 0

  const formatDelta = (d: number) => {
    const sign = d >= 0 ? "+" : ""
    return `${sign}${d}%`
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>

        <CardTitle className="text-4xl font-bold">
          {value}
        </CardTitle>

        {delta !== undefined && (
          <CardAction>
            <Badge
              variant="outline"
              className={cn(
                "flex items-center gap-1 shrink-0 min-w-0",
                isPositive ? "text-green-600" : "text-red-600"
              )}
            >
              <span className="shrink-0">
                {isPositive ? (
                  <TrendingUp className="size-4" />
                ) : (
                  <TrendingDown className="size-4" />
                )}
              </span>
              <span className="truncate">{formatDelta(delta)}</span>
            </Badge>
          </CardAction>
        )}
      </CardHeader>

      {(description || subtitle) && (
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {description && (
            <div className="font-medium">
              {description}{" "}
              {delta !== undefined && (
                <span className="inline-flex items-center align-middle">
                  {isPositive ? (
                    <TrendingUp className="size-4" />
                  ) : (
                    <TrendingDown className="size-4" />
                  )}
                </span>
              )}
            </div>
          )}
          {subtitle && <div className="text-muted-foreground">{subtitle}</div>}
        </CardFooter>
      )}
    </Card>
  )
}

// Static Skeleton version
MetricCard.Skeleton = function MetricCardSkeleton() {
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>
          <Skeleton className="h-4 w-24" />
        </CardDescription>

        <CardTitle className="text-4xl font-bold">
          <Skeleton className="h-8 w-20" />
        </CardTitle>

        <CardAction>
          <Skeleton className="h-6 w-16 rounded-md" />
        </CardAction>
      </CardHeader>

      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="flex gap-2 font-medium">
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="text-muted-foreground">
          <Skeleton className="h-3 w-24" />
        </div>
      </CardFooter>
    </Card>
  )
}
