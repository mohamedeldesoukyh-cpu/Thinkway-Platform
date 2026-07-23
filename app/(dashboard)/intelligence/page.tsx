import { redirect } from "next/navigation";
import { Suspense } from "react";

import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { Skeleton } from "@/components/ui/skeleton";
import { IntelligenceWorkspace } from "@/features/intelligence/components/intelligence-workspace-lazy";
import { getIntelligenceWorkspace } from "@/features/intelligence/queries";
import { isIntelligenceEnabled } from "@/lib/intelligence/feature-flag";

type PageProps = {
  searchParams: Promise<{ tab?: string }>;
};

function IntelligenceWorkspaceFallback() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-full max-w-2xl" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-40 shrink-0 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-lg rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

async function IntelligenceWorkspaceLoader({ tab }: { tab?: string }) {
  const data = await getIntelligenceWorkspace(tab);
  return <IntelligenceWorkspace data={data} />;
}

export default async function IntelligencePage({ searchParams }: PageProps) {
  if (!isIntelligenceEnabled()) {
    redirect("/campaigns");
  }

  const params = await searchParams;

  return (
    <DashboardShell
      title="Thinkway Intelligence"
      description="Historical campaign, vendor, and margin intelligence from 2023–2026 operational data."
    >
      <PlatformErrorBoundary surface="analytics">
        <Suspense fallback={<IntelligenceWorkspaceFallback />}>
          <IntelligenceWorkspaceLoader tab={params.tab} />
        </Suspense>
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
