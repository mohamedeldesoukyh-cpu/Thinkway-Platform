import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function IntelligenceLoading() {
  return (
    <DashboardShell
      title="Thinkway Intelligence"
      description="Historical campaign, vendor, and margin intelligence from 2023–2026 operational data."
    >
      <div className="space-y-6">
        <Skeleton className="h-4 w-full max-w-2xl" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-40 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </DashboardShell>
  );
}
