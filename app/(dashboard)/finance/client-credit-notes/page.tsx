import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { AdjustmentModuleShell } from "@/features/finance/adjustments/components/adjustment-module-shell";

export default function ClientCreditNotesPage() {
  return (
    <DashboardShell
      title="Client credit notes"
      description="Reduce client receivable against issued invoices. Documents are never deleted — cancel, void, or reverse only."
    >
      <PlatformErrorBoundary surface="finance">
        <AdjustmentModuleShell moduleKey="client_credit" />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
