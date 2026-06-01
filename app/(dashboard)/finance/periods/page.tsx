import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PeriodManagementWorkspace } from "@/features/finance/components/period-management-workspace";
import { getFinancialPeriods } from "@/features/operations/queries";

export default async function FinancePeriodsPage() {
  let periods;
  let errorMessage: string | null = null;

  try {
    periods = await getFinancialPeriods();
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load period management.";
  }

  return (
    <DashboardShell
      title="Period management"
      description="Finance governance — open, soft lock, and full lock accounting periods with audit trail."
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : periods ? (
        <PeriodManagementWorkspace periods={periods} />
      ) : null}
    </DashboardShell>
  );
}
