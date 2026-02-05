import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Document Header skeleton */}
      <div className="border-b pb-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-8 w-3/4" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-14" />
            </div>
            <Skeleton className="h-16 w-full max-w-3xl" />
            <div className="flex gap-1 pt-1">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-5 w-20" />
              ))}
            </div>
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
      </div>

      {/* PDF Viewer skeleton */}
      <div className="flex-1 min-h-0 flex gap-4">
        <div className="flex-1 border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-2 border-b bg-muted/50">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-8 w-8" />
              <Skeleton className="h-8 w-28" />
            </div>
          </div>
          <div className="flex-1 bg-gray-100 p-4 h-full flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading PDF...</p>
            </div>
          </div>
        </div>

        {/* Comment sidebar skeleton */}
        <div className="w-80 border rounded-lg overflow-hidden">
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="h-3 w-48 mt-1" />
          </div>
          <div className="p-3 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
