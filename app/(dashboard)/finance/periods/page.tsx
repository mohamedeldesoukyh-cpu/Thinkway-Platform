import { FinanceSuiteShell } from "@/components/finance/suite";
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
    <FinanceSuiteShell
      title="Period management"
      description="Soft and full locks on financial periods"
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : periods ? (
        <PeriodManagementWorkspace periods={periods} />
      ) : null}
    </FinanceSuiteShell>
  );
}
