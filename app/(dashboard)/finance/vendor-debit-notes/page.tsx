import { FinanceSuiteShell } from "@/components/finance/suite";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { AdjustmentModuleShell } from "@/features/finance/adjustments/components/adjustment-module-shell";

export default function VendorDebitNotesPage() {
  return (
    <FinanceSuiteShell
      title="Vendor debit notes"
      description="Debits raised against vendors"
    >
      <PlatformErrorBoundary surface="finance">
        <AdjustmentModuleShell moduleKey="vendor_debit" />
      </PlatformErrorBoundary>
    </FinanceSuiteShell>
  );
}
