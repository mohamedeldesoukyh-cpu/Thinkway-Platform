import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ExchangeRatesWorkspace } from "@/features/finance/exchange-rates/components/exchange-rates-workspace";
import { getExchangeRatesWorkspace } from "@/features/finance/exchange-rates/queries";

export default async function FinanceExchangeRatesPage() {
  let errorMessage: string | null = null;
  let data = null;

  try {
    data = await getExchangeRatesWorkspace();
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load exchange rates.";
  }

  return (
    <DashboardShell
      title="Exchange rates"
      description="Centralized currency master data, effective-dated FX governance, and audit history."
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : data ? (
        <ExchangeRatesWorkspace data={data} />
      ) : null}
    </DashboardShell>
  );
}
