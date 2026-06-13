import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { ReportsHubView } from "@/features/reports/components/reports-hub-view";

export default function ReportsPage() {
  return (
    <DashboardShell
      title="Performance Reports"
      description="Analytics across campaigns, vendors, finance, and channels."
    >
      <PlatformErrorBoundary surface="analytics">
        <ReportsHubView />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
