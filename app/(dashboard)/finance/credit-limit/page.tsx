import { FinanceSuiteShell } from "@/components/finance/suite";
import { CreditLimitWorkspace } from "@/features/finance/credit-limit/components/credit-limit-workspace";
import { getCreditLimitWorkspace } from "@/features/finance/credit-limit/queries";

export default async function FinanceCreditLimitPage() {
  let errorMessage: string | null = null;
  let data = null;

  try {
    data = await getCreditLimitWorkspace();
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Failed to load credit limits.";
  }

  return (
    <FinanceSuiteShell
      title="Credit limit"
      description="Manage client credit limits, enforcement toggles, and risk acceptance across all legal entities."
    >
      {errorMessage ? (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : data ? (
        <CreditLimitWorkspace data={data} />
      ) : null}
    </FinanceSuiteShell>
  );
}
