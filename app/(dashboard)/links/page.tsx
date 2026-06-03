import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { LinkGeneratorWorkspace } from "@/features/links/components/link-generator-workspace";

export default function LinkGeneratorPage() {
  return (
    <DashboardShell
      title="Link Generator"
      description="Create trackable affiliate and campaign links."
    >
      <PlatformErrorBoundary surface="generic">
        <LinkGeneratorWorkspace />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
