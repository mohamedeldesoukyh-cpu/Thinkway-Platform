import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PerformanceGovernanceDashboard } from "@/features/platform/components/performance-governance-dashboard";
import { loadPerformanceGovernance } from "@/lib/platform/performance-governance/load-governance";

export default function SystemPerformancePage() {
  const data = loadPerformanceGovernance();

  return (
    <DashboardShell
      title="Performance governance"
      description="Engineering budgets for bundle, CSS, client modules, API/SQL SLOs, and Core Web Vitals. Enforced in CI after production build."
    >
      <PlatformErrorBoundary surface="generic">
        <PerformanceGovernanceDashboard {...data} />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
