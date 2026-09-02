import { FinanceSuiteShell } from "@/components/finance/suite";
import { PlatformErrorBoundary } from "@/components/platform/error-boundary";
import { FinanceInvoicesListSection } from "@/features/finance/invoices/components/finance-invoices-list-section";
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
    <FinanceSuiteShell
      title="Invoices"
      description="Client invoice register with VAT before and after"
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : (
        <PlatformErrorBoundary surface="invoices">
          <FinanceInvoicesListSection rows={rows} />
        </PlatformErrorBoundary>
      )}
    </FinanceSuiteShell>
  );
}
