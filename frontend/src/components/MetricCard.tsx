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
import { ArrowUp, ArrowDown } from "iconoir-react"
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

        <CardTitle className="text-4xl">
          {value.toLocaleString()}
        </CardTitle>

        {delta !== undefined && (
          <CardAction>
            <Badge
              variant="outline"
              className={cn(
                "flex items-center gap-1.5 shrink-0 min-w-0 border-0 px-2.5 py-1",
                isPositive 
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" 
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
              )}
            >
              <span className="shrink-0">
                {isPositive ? (
                  <ArrowUp className="size-3.5 stroke-[2.5]" />
                ) : (
                  <ArrowDown className="size-3.5 stroke-[2.5]" />
                )}
              </span>
              <span className="truncate font-semibold text-xs">{formatDelta(delta)}</span>
            </Badge>
          </CardAction>
        )}
      </CardHeader>

      {(description || subtitle) && (
        <CardFooter className="flex-col items-start gap-2">
          {description && (
            <div className="font-medium text-foreground/90 leading-relaxed">
              {description}
            </div>
          )}
          {subtitle && (
            <div className="text-muted-foreground/80 leading-relaxed">
              {subtitle}
            </div>
          )}
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
          <Skeleton className="h-3 w-28 rounded-md" />
        </CardDescription>

        <CardTitle className="text-4xl">
          <Skeleton className="h-10 w-24 rounded-md" />
        </CardTitle>

        <CardAction>
          <Skeleton className="h-7 w-16 rounded-full" />
        </CardAction>
      </CardHeader>

      <CardFooter className="flex-col items-start gap-2">
        <Skeleton className="h-4 w-40 rounded-md" />
        <Skeleton className="h-3 w-32 rounded-md" />
      </CardFooter>
    </Card>
  )
}
