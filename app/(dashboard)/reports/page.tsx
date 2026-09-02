import { FinanceSuiteShell } from "@/components/finance/suite";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { ReportsHubView } from "@/features/reports/components/reports-hub-view";

export default function ReportsPage() {
  return (
    <FinanceSuiteShell
      title="Performance reports"
      description="Twelve reports across finance, commercial and cash"
    >
      <PlatformErrorBoundary surface="analytics">
        <ReportsHubView />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
