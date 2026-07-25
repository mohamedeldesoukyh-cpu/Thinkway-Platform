import { redirect } from "next/navigation";

import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { PageFallback } from "@/components/platform/page-fallback";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireOperationsCenterAccess } from "@/features/operations-center/auth";
import { OperationsCenterDashboard } from "@/features/operations-center/components/operations-center-dashboard";
import { buildOperationsCenterSnapshot } from "@/features/operations-center/services/build-snapshot";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeServerQuery } from "@/lib/platform/safe-query";

export const dynamic = "force-dynamic";

export default async function OperationsCenterPage() {
  const supabase = await createSupabaseServerClient();
  const auth = await requireOperationsCenterAccess(supabase);
  if ("error" in auth) {
    if (auth.status === 401) redirect("/login?next=/operations");
    redirect("/");
  }

  const result = await safeServerQuery(
    "operations-center-snapshot",
    () => buildOperationsCenterSnapshot(supabase),
    null,
  );

  return (
    <DashboardShell
      title="Operations Center"
      description="Deployment verification and explainable production health — adapters, score breakdown, queues, and dependency diagnostics. Internal staff only."
    >
      <PlatformErrorBoundary surface="generic">
        {result.fallbackUsed || !result.data ? (
          <PageFallback
            title="Operations Center unavailable"
            description="Could not build the operational snapshot."
            hint={result.error ?? undefined}
            variant="warning"
          />
        ) : (
          <OperationsCenterDashboard snapshot={result.data} />
        )}
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
