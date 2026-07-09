import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { DiscoveryDiagnosticsSection } from "@/features/discovery/control-center/components/discovery-diagnostics-section";
import { getDiscoveryDiagnosticsSnapshot } from "@/features/discovery/control-center/queries";

export default async function DiscoveryDiagnosticsPage() {
  const snapshot = await getDiscoveryDiagnosticsSnapshot();

  return (
    <DashboardShell
      title="Discovery Diagnostics"
      description="Operational health for discovery mode, queue, Apify usage, DNA coverage, and audit history."
    >
      <PlatformErrorBoundary surface="generic">
        <DiscoveryDiagnosticsSection snapshot={snapshot} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
