import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { AdjustmentModuleShell } from "@/features/finance/adjustments/components/adjustment-module-shell";

export default function ClientDebitNotesPage() {
  return (
    <DashboardShell
      title="Client debit notes"
      description="Increase client receivable for fees, penalties, or late additions."
    >
      <PlatformErrorBoundary surface="finance">
        <AdjustmentModuleShell moduleKey="client_debit" />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
