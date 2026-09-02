import { FinanceSuiteShell } from "@/components/finance/suite";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { AdjustmentModuleShell } from "@/features/finance/adjustments/components/adjustment-module-shell";

export default function ClientCreditNotesPage() {
  return (
    <FinanceSuiteShell
      title="Client credit notes"
      description="Credits raised against client invoices"
    >
      <PlatformErrorBoundary surface="finance">
        <AdjustmentModuleShell moduleKey="client_credit" />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
