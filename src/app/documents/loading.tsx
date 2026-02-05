import { Skeleton } from "@/components/ui/skeleton";

export default function DocumentsLoading() {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar skeleton */}
      <aside className="w-full lg:w-72 shrink-0">
        <div className="space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-6 w-16" />
              ))}
            </div>
          </div>
          <Skeleton className="h-px w-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-6 w-14" />
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content skeleton */}
      <div className="flex-1">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>

        <Skeleton className="h-10 w-full mb-6" />

        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="border rounded-lg p-4">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-3" />
              <Skeleton className="h-16 w-full mb-3" />
              <div className="flex gap-2">
                {[1, 2, 3].map((j) => (
                  <Skeleton key={j} className="h-5 w-16" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
