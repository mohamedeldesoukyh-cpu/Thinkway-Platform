import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { AdjustmentModuleShell } from "@/features/finance/adjustments/components/adjustment-module-shell";

export default function VendorDebitNotesPage() {
  return (
    <DashboardShell
      title="Vendor debit notes"
      description="Increase supplier payable for creator compensation or operational adjustments."
    >
      <PlatformErrorBoundary surface="finance">
        <AdjustmentModuleShell moduleKey="vendor_debit" />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
