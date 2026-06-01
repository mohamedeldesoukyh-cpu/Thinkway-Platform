import { DashboardShell } from "@/components/layout/dashboard-shell";
import { VatWorkspace } from "@/features/finance/vat/components/vat-workspace";
import { getVatWorkspace } from "@/features/finance/vat/queries";

export default async function FinanceVatPage() {
  let data;
  let errorMessage: string | null = null;

  try {
    data = await getVatWorkspace();
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load VAT workspace.";
  }

  return (
    <DashboardShell
      title="VAT & tax"
      description="Output VAT, input VAT, settlement, and audit exports. Operational dashboards remain ex-VAT."
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : data ? (
        <VatWorkspace data={data} />
      ) : null}
    </DashboardShell>
  );
}
