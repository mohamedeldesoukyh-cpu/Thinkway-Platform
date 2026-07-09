import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { DiscoveryEngineSettingsSection } from "@/features/discovery/control-center/components/discovery-engine-settings-section";
import { getDiscoveryEngineSettings } from "@/features/discovery/control-center/queries";

export default async function DiscoveryEngineSettingsPage() {
  const settings = await getDiscoveryEngineSettings();

  return (
    <DashboardShell
      title="Discovery Engine"
      description="Enterprise control center for discovery source, enrichment, DNA flags, and cost protection."
    >
      <PlatformErrorBoundary surface="generic">
        <DiscoveryEngineSettingsSection settings={settings} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
