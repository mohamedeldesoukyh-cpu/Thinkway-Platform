import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { OperationalTableSection } from "@/components/ui/operational-table-section";
import { FinanceInvoiceRegisterTable } from "@/features/finance/invoices/components/finance-invoice-register-table";
import { getFinanceInvoiceRegister } from "@/features/finance/invoices/queries";

export default async function FinanceInvoicesPage() {
  let rows: Awaited<ReturnType<typeof getFinanceInvoiceRegister>> = [];
  let errorMessage: string | null = null;

  try {
    rows = await getFinanceInvoiceRegister();
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load invoice register.";
  }

  return (
    <DashboardShell
      title="Invoices"
      description="Master operational invoice register — one row per invoice across all campaigns."
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : (
        <PlatformErrorBoundary surface="invoices">
          <OperationalTableSection
            title="Invoice register"
            description={`${rows.length} invoice${rows.length === 1 ? "" : "s"} in the system.`}
          >
            <FinanceInvoiceRegisterTable rows={rows} showUngenerate />
          </OperationalTableSection>
        </PlatformErrorBoundary>
      )}
    </DashboardShell>
  );
}
