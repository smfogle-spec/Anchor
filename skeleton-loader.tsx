import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
    />
  );
}

export function ScheduleRowSkeleton() {
  return (
    <div className="flex items-center gap-2 p-2 border-b border-border">
      <Skeleton className="h-8 w-24" />
      <div className="flex-1 flex gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 flex-1" />
        ))}
      </div>
    </div>
  );
}

export function ScheduleGridSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="space-y-0">
      <div className="flex items-center gap-2 p-2 bg-muted/50 border-b">
        <Skeleton className="h-6 w-20" />
        <div className="flex-1 flex gap-1">
          {["7:00", "8:30", "11:30", "12:00", "12:30", "4:00"].map((t) => (
            <div key={t} className="flex-1 text-center">
              <span className="text-xs text-muted-foreground">{t}</span>
            </div>
          ))}
        </div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <ScheduleRowSkeleton key={i} />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="p-2">
          <Skeleton className="h-6 w-full" />
        </td>
      ))}
    </tr>
  );
}

export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <CardSkeleton />
    </div>
  );
}

export function ExportProgress({ progress, message }: { progress: number; message: string }) {
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-card border rounded-lg p-6 shadow-lg max-w-sm w-full mx-4 space-y-4">
        <div className="text-center">
          <div className="text-lg font-medium">Exporting Schedule</div>
          <div className="text-sm text-muted-foreground">{message}</div>
        </div>
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div 
            className="bg-primary h-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="text-center text-sm text-muted-foreground">
          {progress.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
