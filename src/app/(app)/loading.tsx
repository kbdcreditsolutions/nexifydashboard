import { Skeleton } from "@/components/ui/skeleton";

// Shown instantly while a page under (app) is server-rendering — every
// route here is fully dynamic (live Prisma queries), so without this the
// navigation Links (all prefetch={false}, see sidebar.tsx) would otherwise
// feel like a dead click until the new page's data finishes loading.
export default function AppLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3.5 w-64" />
        </div>
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-lg" />
    </div>
  );
}
