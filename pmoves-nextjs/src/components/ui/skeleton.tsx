import * as React from "react"

import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

function SkeletonCard({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-card"
      className={cn("rounded-xl border bg-card p-6 space-y-4", className)}
      {...props}
    >
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-[200px] w-full" />
    </div>
  )
}

function SkeletonChart({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton-chart"
      className={cn("rounded-xl border bg-card p-6 space-y-4", className)}
      {...props}
    >
      <div className="flex justify-between items-center">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-[300px] w-full" />
    </div>
  )
}

function SkeletonTable({ rows = 5, className, ...props }: React.ComponentProps<"div"> & { rows?: number }) {
  return (
    <div
      data-slot="skeleton-table"
      className={cn("rounded-xl border bg-card p-6 space-y-3", className)}
      {...props}
    >
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

export { Skeleton, SkeletonCard, SkeletonChart, SkeletonTable }
