import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { AdjustmentModuleShell } from "@/features/finance/adjustments/components/adjustment-module-shell";

export default function VendorCreditNotesPage() {
  return (
    <DashboardShell
      title="Vendor credit notes"
      description="Reduce supplier payable against vendor IO or vendor invoices."
    >
      <PlatformErrorBoundary surface="finance">
        <AdjustmentModuleShell moduleKey="vendor_credit" />
      </PlatformErrorBoundary>
    </DashboardShell>
  );
}
