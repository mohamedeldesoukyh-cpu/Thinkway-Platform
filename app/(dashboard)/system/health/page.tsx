import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { PageFallback } from "@/components/platform/page-fallback";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SystemHealthDashboard } from "@/features/platform/components/system-health-dashboard";
import { runPlatformHealthChecks } from "@/lib/platform/health/run-health";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeServerQuery } from "@/lib/platform/safe-query";

export default async function SystemHealthPage() {
  const supabase = await createSupabaseServerClient();

  const result = await safeServerQuery(
    "platform-health-page",
    () => runPlatformHealthChecks(supabase),
    {
      generated_at: new Date().toISOString(),
      overall: "error" as const,
      checks: [
        {
          id: "health_failed",
          section: "database" as const,
          label: "Health runner",
          status: "error" as const,
          message: "Could not complete health checks.",
          durationMs: 0,
        },
      ],
    }
  );

  return (
    <DashboardShell
      title="System health"
      description="Runtime diagnostics for database, billing, analytics, planning, and operational isolation."
    >
      <PlatformErrorBoundary surface="generic">
        {result.fallbackUsed ? (
          <div className="mb-4">
            <PageFallback
              title="Partial health report"
              description="Some checks could not run. Results below may be incomplete."
              hint={result.error ?? undefined}
              variant="warning"
            />
          </div>
        ) : null}
        <SystemHealthDashboard report={result.data} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
