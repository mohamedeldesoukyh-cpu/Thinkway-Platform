import { FinanceSuiteShell } from "@/components/finance/suite";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { AdjustmentModuleShell } from "@/features/finance/adjustments/components/adjustment-module-shell";

export default function VendorCreditNotesPage() {
  return (
    <FinanceSuiteShell
      title="Vendor credit notes"
      description="Credits received from vendors"
    >
      <PlatformErrorBoundary surface="finance">
        <AdjustmentModuleShell moduleKey="vendor_credit" />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
